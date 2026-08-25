import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { formatDateLabel, isTargetEligible, playerFullName } from "@/lib/format";
import { runBirthdayReminders } from "@/lib/cron/birthdayJob";
import { runTeamDeletionSweep } from "@/lib/cron/teamDeletionJob";
import type { Database, ReminderType, Schedule } from "@/lib/database.types";

export const dynamic = "force-dynamic";

// 出欠登録リマインドの日次バッチ(Vercel Cronから毎朝JST8時頃に叩かれる想定)。
// 全チーム横断で以下3条件をチェックし、未登録者にだけ個別プッシュを送る:
// ・全種別共通: 予定日の2日前
// ・試合/イベントでattendance_deadlineを設定した場合のみ: 期限日当日
// ・同上: 期限を過ぎてもなお未登録の場合、予定日の1週間前に再通知
// 同じ予定・同じ種類のリマインドを二重送信しないよう、attendance_reminder_logで管理する。
// あわせて、Vercel Cronのジョブ数を増やさないよう、選手の誕生日プッシュ通知(runBirthdayReminders)や
// 退会猶予期間(7日)を過ぎたチームの完全削除(runTeamDeletionSweep)も
// この日次バッチの中でまとめて処理する。

function jstToday(): Date {
  const jstMs = Date.now() + 9 * 60 * 60 * 1000;
  const d = new Date(jstMs);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildMessage(schedule: Schedule, reminderType: ReminderType): { title: string; body: string } {
  const dateLabel = formatDateLabel(schedule.date);
  if (reminderType === "deadline_day") {
    return { title: "⏰ 本日が出欠登録の期限です", body: `「${schedule.title}」(${dateLabel})の出欠登録期限は本日です` };
  }
  if (reminderType === "week_before") {
    return {
      title: "⚠️ 出欠登録の期限を過ぎています",
      body: `「${schedule.title}」(${dateLabel})の出欠登録がまだ済んでいません(開催まで1週間)`,
    };
  }
  return { title: "📅 出欠登録はお済みですか?", body: `「${schedule.title}」(${dateLabel})の出欠登録がまだ済んでいません` };
}

// 出欠フォーム(schedule/[id]/page.tsx)と同じ対象範囲判定で、未登録の人を洗い出す。
// key: profile_id, value: 対象のラベル(選手名、または「本人」「自分」)の一覧。
// 対象ユーザーの抽出はprofiles.team_id(legacy)ではなくteam_memberships.team_idを正本とする。
// このRoute全体がservice_roleクライアント(rolbypassrls=trueをローカルDBで実測確認済み)で
// 動作するため、RLSポリシーが0件のteam_membershipsも直接SELECTできる。
async function computeUnregisteredRecipients(
  supabase: SupabaseClient<Database>,
  schedule: Schedule,
): Promise<Map<string, string[]>> {
  const recipients = new Map<string, string[]>();

  const [{ data: players }, { data: memberships }, { data: attendances }] = await Promise.all([
    supabase.from("players").select("*").eq("team_id", schedule.team_id).eq("status", "在籍"),
    supabase.from("team_memberships").select("user_id, role").eq("team_id", schedule.team_id),
    supabase.from("attendances").select("*").eq("schedule_id", schedule.id),
  ]);
  const membershipUserIds = (memberships ?? []).map((m) => m.user_id);
  const { data: profiles } =
    membershipUserIds.length > 0
      ? await supabase.from("profiles").select("id, name").in("id", membershipUserIds)
      : { data: [] };
  const roleByUserId = new Map((memberships ?? []).map((m) => [m.user_id, m.role]));

  const eligiblePlayers = (players ?? []).filter((p) => isTargetEligible(p.grade, schedule.target_grade_min));
  const eligiblePlayerIds = eligiblePlayers.map((p) => p.id);

  const { data: links } =
    eligiblePlayerIds.length > 0
      ? await supabase.from("player_guardians").select("player_id, profile_id").in("player_id", eligiblePlayerIds)
      : { data: [] };

  const guardiansByPlayer = new Map<string, string[]>();
  (links ?? []).forEach((l) => {
    const arr = guardiansByPlayer.get(l.player_id) ?? [];
    arr.push(l.profile_id);
    guardiansByPlayer.set(l.player_id, arr);
  });

  const attByPlayer = new Set((attendances ?? []).filter((a) => a.player_id).map((a) => a.player_id as string));
  const attByUser = new Set((attendances ?? []).filter((a) => !a.player_id).map((a) => a.user_id));

  // 対象学年の子どもに1人でも紐付いている保護者は「自分」の出欠登録対象にはならない
  // (出欠フォーム側の list.length===0 フォールバックと同じ判定)。
  const coveredGuardianIds = new Set<string>();
  for (const player of eligiblePlayers) {
    const guardianIds = guardiansByPlayer.get(player.id) ?? [];
    guardianIds.forEach((id) => coveredGuardianIds.add(id));
    if (attByPlayer.has(player.id)) continue;
    for (const guardianId of guardianIds) {
      const arr = recipients.get(guardianId) ?? [];
      arr.push(playerFullName(player));
      recipients.set(guardianId, arr);
    }
  }

  for (const profile of profiles ?? []) {
    const memberRole = roleByUserId.get(profile.id);
    if (memberRole === "指導者" || memberRole === "管理者") {
      if (!attByUser.has(profile.id)) {
        const arr = recipients.get(profile.id) ?? [];
        arr.push("本人");
        recipients.set(profile.id, arr);
      }
    } else if (!coveredGuardianIds.has(profile.id) && !attByUser.has(profile.id)) {
      const arr = recipients.get(profile.id) ?? [];
      arr.push("自分");
      recipients.set(profile.id, arr);
    }
  }

  return recipients;
}

async function sendToRecipients(
  supabase: SupabaseClient<Database>,
  recipients: Map<string, string[]>,
  title: string,
  bodyBase: string,
  url: string,
): Promise<number> {
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth_key")
    .in("user_id", [...recipients.keys()]);

  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      const labels = recipients.get(s.user_id) ?? [];
      const body = labels.length > 0 ? `${bodyBase}(対象: ${labels.join("・")})` : bodyBase;
      const payload = JSON.stringify({ title, body, url });
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, payload);
        sent += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number } | null)?.statusCode;
        console.error(`[cron/attendance-reminders] send failed (subscription ${s.id}, status ${statusCode})`, err);
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }),
  );
  return sent;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!vapidPublicKey || !vapidPrivateKey || !serviceRoleKey) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  webpush.setVapidDetails("mailto:info@faith-creation.jp", vapidPublicKey, vapidPrivateKey);

  const supabase = createSupabaseJsClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const today = jstToday();
  const todayStr = toDateStr(today);
  const in2DaysStr = toDateStr(addDays(today, 2));
  const in7DaysStr = toDateStr(addDays(today, 7));

  const birthdayResult = await runBirthdayReminders(supabase, todayStr);
  const teamDeletionResult = await runTeamDeletionSweep(supabase);

  const [{ data: baseline }, { data: deadlineDay }, { data: weekBefore }] = await Promise.all([
    supabase.from("schedules").select("*").eq("date", in2DaysStr).eq("send_attendance_reminders", true),
    supabase
      .from("schedules")
      .select("*")
      .in("type", ["game", "event"])
      .eq("attendance_deadline", todayStr)
      .eq("send_attendance_reminders", true),
    supabase
      .from("schedules")
      .select("*")
      .in("type", ["game", "event"])
      .eq("date", in7DaysStr)
      .not("attendance_deadline", "is", null)
      .lt("attendance_deadline", todayStr)
      .eq("send_attendance_reminders", true),
  ]);

  const jobs: { schedule: Schedule; reminderType: ReminderType }[] = [
    ...(baseline ?? []).map((schedule) => ({ schedule, reminderType: "baseline_2days" as const })),
    ...(deadlineDay ?? []).map((schedule) => ({ schedule, reminderType: "deadline_day" as const })),
    ...(weekBefore ?? []).map((schedule) => ({ schedule, reminderType: "week_before" as const })),
  ];

  if (jobs.length === 0) {
    return NextResponse.json({ ok: true, jobs: 0, birthdays: birthdayResult, teamDeletions: teamDeletionResult });
  }

  const { data: existingLogs } = await supabase
    .from("attendance_reminder_log")
    .select("schedule_id, reminder_type")
    .in(
      "schedule_id",
      jobs.map((j) => j.schedule.id),
    );
  const sentSet = new Set((existingLogs ?? []).map((l) => `${l.schedule_id}:${l.reminder_type}`));
  const pendingJobs = jobs.filter((j) => !sentSet.has(`${j.schedule.id}:${j.reminderType}`));

  const results: { scheduleId: string; reminderType: ReminderType; recipients: number; sent: number }[] = [];

  for (const job of pendingJobs) {
    const recipients = await computeUnregisteredRecipients(supabase, job.schedule);
    let sent = 0;
    if (recipients.size > 0) {
      const { title, body } = buildMessage(job.schedule, job.reminderType);
      sent = await sendToRecipients(supabase, recipients, title, body, `/schedule/${job.schedule.id}`);
    }
    results.push({ scheduleId: job.schedule.id, reminderType: job.reminderType, recipients: recipients.size, sent });
    await supabase
      .from("attendance_reminder_log")
      .insert({ schedule_id: job.schedule.id, reminder_type: job.reminderType });
  }

  return NextResponse.json({
    ok: true,
    jobs: jobs.length,
    processed: pendingJobs.length,
    results,
    birthdays: birthdayResult,
    teamDeletions: teamDeletionResult,
  });
}
