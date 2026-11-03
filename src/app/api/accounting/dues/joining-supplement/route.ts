import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { canManageAccounting } from "@/lib/permissions";
import { hasAccountingAccess } from "@/lib/plan";
import { fiscalMonthDate } from "@/lib/duesAnnualSchedule";
import { previewJoiningSupplement } from "@/lib/duesJoiningSupplement";
import { resolveMonthlyAmount } from "@/lib/accountingDues";
import type { Database, Role } from "@/lib/database.types";
import type { DuesPricingMethod } from "@/lib/accounting";

export async function POST(request: Request) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  const [{ data: teamId }, { data: role }] = await Promise.all([
    session.rpc("current_team_id"), session.rpc("current_role"),
  ]);
  if (!teamId || !role || !canManageAccounting(role as Role)) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  const { data: team } = await session.from("teams").select("plan").eq("id", teamId).single();
  if (!team || !hasAccountingAccess(team.plan)) return NextResponse.json({ error: "会計機能を利用できません" }, { status: 403 });
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return NextResponse.json({ error: "サーバー設定がありません" }, { status: 500 });
  const db = createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const body = await request.json().catch(() => null);
  const { duesItemId, playerId, fiscalYear, confirm } = body ?? {};
  if (typeof duesItemId !== "string" || typeof playerId !== "string" || !Number.isInteger(fiscalYear) || typeof confirm !== "boolean") {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }
  const [{ data: item }, { data: player }, { data: setting }, { data: bands }] = await Promise.all([
    db.from("accounting_dues_items").select("*").eq("team_id", teamId).eq("id", duesItemId).maybeSingle(),
    db.from("players").select("id,grade").eq("team_id", teamId).eq("id", playerId).maybeSingle(),
    db.from("accounting_dues_player_settings").select("*").eq("dues_item_id", duesItemId).eq("player_id", playerId).maybeSingle(),
    db.from("accounting_dues_grade_bands").select("*").eq("dues_item_id", duesItemId),
  ]);
  if (!item || !player || !setting?.start_date || item.schedule_mode !== "configured" || item.rate_basis !== "monthly") {
    return NextResponse.json({ error: "月額設定と入団日の登録が必要です" }, { status: 400 });
  }
  if (item.billing_unit === "household") return NextResponse.json({ error: "世帯請求の追加処理は未対応です" }, { status: 400 });
  const amount = resolveMonthlyAmount({
    pricingMethod: item.pricing_method as DuesPricingMethod,
    flatMonthlyAmount: item.flat_monthly_amount,
    grade: player.grade === null ? null : Number(player.grade),
    gradeBands: bands ?? [],
    playerSetting: setting,
  });
  if (amount === null || amount <= 0) return NextResponse.json({ error: "請求対象の月額がありません" }, { status: 400 });
  let preview;
  try {
    preview = previewJoiningSupplement({ plan: { basis: "monthly", amount, collectionMonths: item.collection_months ?? [] }, fiscalYear, joinDate: setting.start_date });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "計算できません" }, { status: 400 });
  }
  if (!preview) return NextResponse.json({ error: "追加請求の対象期間がありません" }, { status: 400 });
  const start = fiscalMonthDate(fiscalYear, preview.coveredMonths[0]);
  const last = fiscalMonthDate(fiscalYear, preview.coveredMonths[preview.coveredMonths.length - 1]);
  const [y, m] = last.split("-").map(Number);
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const { data: existingPeriods, error: periodLookupError } = await db.from("accounting_dues_billing_periods").select("id,period_start,period_end").eq("dues_item_id", duesItemId).eq("fiscal_year", fiscalYear);
  if (periodLookupError) return NextResponse.json({ error: "既存請求を確認できません" }, { status: 500 });
  const overlapping = (existingPeriods ?? []).filter(p => p.period_start <= end && p.period_end >= start);
  if (overlapping.length) {
    const { data: existingCharges, error } = await db.from("accounting_dues_charges").select("id").eq("player_id", playerId).in("billing_period_id", overlapping.map(p => p.id));
    if (error) return NextResponse.json({ error: "既存請求を確認できません" }, { status: 500 });
    if ((existingCharges ?? []).length) return NextResponse.json({ error: "対象期間に既存請求があります。重複を避けるため追加できません" }, { status: 409 });
  }
  if (!confirm) return NextResponse.json({ ok: true, preview: { ...preview, start, end } });
  // 管理者の明示的な確定操作後にだけ請求を保存する。
  const { data: period, error: createError } = await db.from("accounting_dues_billing_periods").insert({
    dues_item_id: duesItemId, fiscal_year: fiscalYear, period_start: start, period_end: end,
  }).select("id").single();
  if (createError || !period) return NextResponse.json({ error: "請求期間を作成できませんでした" }, { status: 500 });
  const { error: chargeError } = await db.from("accounting_dues_charges").insert({
    billing_period_id: period.id, player_id: playerId, group_key: playerId, amount: preview.amount,
  });
  if (chargeError) {
    await db.from("accounting_dues_billing_periods").delete().eq("id", period.id);
    return NextResponse.json({ error: "追加請求を保存できませんでした" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, created: true, preview: { ...preview, start, end } });
}
