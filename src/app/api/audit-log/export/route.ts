import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { recordAuditEvent } from "@/lib/auditLog";
import { hasAdvancedAuditLogAccess } from "@/lib/plan";
import { AUDIT_ACTION_LABELS, describeAuditDetail } from "@/lib/auditLogDisplay";
import type { AuditAction, Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";

function nextDayStr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 監査ログの絞り込みCSV出力(M-3)。絞り込み自体はaudit_logs_select RLS(自チーム・
// 管理者のみ)で既に安全だが、プラン判定(Max以上)はDB側に表現がないため、このルートで
// 管理者ロール+Maxプランを明示的に検証する。出力内容は画面(describeAuditDetail)と同じ
// 必要最小限の情報に留め、detailの生JSONはそのまま出さない。
export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const actionParam = url.searchParams.get("action");
  const action = actionParam && actionParam in AUDIT_ACTION_LABELS ? (actionParam as AuditAction) : null;
  const actorId = url.searchParams.get("actorId");

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
  if (!teamId || role !== "管理者") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { data: team } = await supabase.from("teams").select("plan").eq("id", teamId).single();
  if (!team || !hasAdvancedAuditLogAccess(team.plan)) {
    return NextResponse.json({ error: "このプランでは利用できません" }, { status: 403 });
  }

  let query = supabase
    .from("audit_logs")
    .select("actor_id, action, detail, created_at")
    .order("created_at", { ascending: false });
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lt("created_at", nextDayStr(to));
  if (action) query = query.eq("action", action);
  if (actorId) query = query.eq("actor_id", actorId);

  const { data: rows, error } = await query;
  if (error) {
    return NextResponse.json({ error: `取得に失敗しました: ${error.message}` }, { status: 500 });
  }

  const actorIds = [...new Set((rows ?? []).map((r) => r.actor_id).filter((id): id is string => id !== null))];
  const actorNames = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", actorIds);
    for (const p of profiles ?? []) actorNames.set(p.id, p.name);
  }

  const csv = toCsv(
    ["操作日時", "操作種別", "操作者", "内容"],
    (rows ?? []).map((r) => [
      r.created_at,
      AUDIT_ACTION_LABELS[r.action],
      r.actor_id ? (actorNames.get(r.actor_id) ?? "退会済みユーザー") : "システム(Stripe連携)",
      describeAuditDetail(r.action, r.detail) ?? "",
    ]),
  );

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) {
    const adminClient = createSupabaseJsClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await recordAuditEvent(adminClient, {
      teamId,
      actorId: user.id,
      action: "data_export",
      targetType: "audit_log",
      detail: { type: "audit_log", from, to, action, actorId },
    });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit_log.csv"`,
    },
  });
}
