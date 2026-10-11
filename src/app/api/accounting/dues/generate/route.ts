import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { generateDuesCharges } from "@/lib/accountingDuesGeneration";
import { canManageAccounting } from "@/lib/permissions";
import { hasAccountingAccess } from "@/lib/plan";
import { todayDateStr } from "@/lib/format";
import { logError } from "@/lib/logger";
import type { Database, Role } from "@/lib/database.types";

// 本日時点の請求を即時生成する(運営以上向け、入金チェック画面の手動トリガー)。
// 通常はcron(/api/cron/attendance-reminders経由のrunDuesGeneration)が毎朝自動で行うが、
// 集金項目を追加した直後など、次のcronを待たずに確認したい場面向けに用意する。
// accounting_dues_billing_periods/chargesへのinsertはservice_roleのみ許可するRLS構成の
// ため、ここでロール・プランを確認したうえでadminClient(service_role)を使って生成する
// (/api/push/notifyと同じ「requestスコープで権限確認→adminClientで実処理」の形)。
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const [{ data: teamId }, { data: role }] = await Promise.all([
    supabase.rpc("current_team_id"),
    supabase.rpc("current_role"),
  ]);
  if (!teamId) {
    return NextResponse.json({ error: "セッション情報を取得できませんでした" }, { status: 404 });
  }
  if (!role || !canManageAccounting(role as Role)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { data: team } = await supabase.from("teams").select("plan").eq("id", teamId).single();
  if (!team || !hasAccountingAccess(team.plan)) {
    return NextResponse.json({ error: "会計機能はProプラン以上限定です" }, { status: 403 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }
  const adminClient = createSupabaseJsClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let duesItemId: string | undefined;
  try {
    const body = await request.json();
    if (typeof body?.duesItemId === "string") duesItemId = body.duesItemId;
  } catch {
    // bodyなし(全項目対象)
  }

  try {
    const result = await generateDuesCharges(adminClient, teamId, todayDateStr(), duesItemId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logError("[accounting/dues/generate] failed", err);
    return NextResponse.json({ error: "生成に失敗しました" }, { status: 500 });
  }
}
