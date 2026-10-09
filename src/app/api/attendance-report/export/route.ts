import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { recordAuditEvent } from "@/lib/auditLog";
import { hasAttendanceReportAccess } from "@/lib/plan";
import type { Database, ScheduleType } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  practice: "練習",
  game: "試合",
  event: "イベント",
  other: "その他",
};

// 出欠の集計レポート(M-2)のCSV出力。集計自体はteam_attendance_report RPC(指導者・
// 管理者限定、RPC内部でもcurrent_role()を検証)に任せ、このルートは権限・プラン確認と
// 監査ログ記録(data_exportとして既存の仕組みに相乗り)のみを担う。
export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const scheduleTypeParam = url.searchParams.get("scheduleType");
  const scheduleType = scheduleTypeParam && scheduleTypeParam in SCHEDULE_TYPE_LABELS ? (scheduleTypeParam as ScheduleType) : null;
  if (!from || !to) {
    return NextResponse.json({ error: "期間を指定してください" }, { status: 400 });
  }

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
  if (!teamId || (role !== "指導者" && role !== "管理者")) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { data: team } = await supabase.from("teams").select("plan").eq("id", teamId).single();
  if (!team || !hasAttendanceReportAccess(team.plan)) {
    return NextResponse.json({ error: "このプランでは利用できません" }, { status: 403 });
  }

  const { data: rows, error } = await supabase.rpc("team_attendance_report", {
    p_from: from,
    p_to: to,
    p_schedule_type: scheduleType,
  });
  if (error) {
    return NextResponse.json({ error: `集計に失敗しました: ${error.message}` }, { status: 500 });
  }

  const csv = toCsv(
    ["姓", "名", "学年", "背番号", "対象予定数", "出席", "欠席", "遅刻早退", "見学", "出席率(%)"],
    (rows ?? []).map((r) => [
      r.sei,
      r.mei,
      r.grade,
      r.number,
      r.eligible_count,
      r.present_count,
      r.absent_count,
      r.late_count,
      r.observe_count,
      r.eligible_count > 0 ? Math.round((r.present_count / r.eligible_count) * 1000) / 10 : "",
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
      targetType: "attendance_report",
      detail: { type: "attendance_report", from, to, scheduleType },
    });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance_report.csv"`,
    },
  });
}
