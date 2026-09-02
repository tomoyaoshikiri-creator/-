import { isTargetEligible } from "@/lib/format";
import type { Attendance, Player, Role, Schedule } from "@/lib/database.types";

// ホーム「要対応」カードの1件。予定の詳細(回答・確認そのもの)は既存の独立画面
// (/schedule/[id])に任せ、ホームはあくまで入口として一覧化するだけに留める。
export interface AttendanceActionItem {
  scheduleId: string;
  scheduleTitle: string;
  scheduleDate: string;
  // 「本人」「自分」または選手名。誰の出欠として未対応なのかを表す。
  targetLabel: string;
  kind: "unanswered" | "carSetup";
  overdue: boolean;
}

type MinimalPlayer = Pick<Player, "id" | "grade"> & { name: string };

function attendanceCarSetupRequired(schedule: Schedule): { car: boolean; setup: boolean } {
  if (schedule.type === "game") {
    const isHome = schedule.venue_type === "ホーム";
    return { car: !isHome, setup: isHome };
  }
  return { car: schedule.collect_car_info, setup: false };
}

// 出欠フォーム(AttendanceEntryForm.tsx)・出欠登録リマインドの日次バッチ
// (src/app/api/cron/attendance-reminders/route.ts)と同じ対象範囲判定(isTargetEligible)を
// 使い、「本人の出欠」「紐づく選手の出欠」のうち未回答・車出し/設営が未回答のものを洗い出す。
// リマインドバッチはチーム全員分をservice_roleで横断計算するのに対し、こちらは
// ホームを開いた「自分」の分だけをRLS配下のクライアントから計算する。
export function computeAttendanceActionItems(params: {
  todayStr: string;
  role: Role;
  userId: string;
  schedules: Schedule[];
  myPlayers: MinimalPlayer[];
  attendances: Attendance[];
}): AttendanceActionItem[] {
  const { todayStr, role, userId, schedules, myPlayers, attendances } = params;
  const isStaff = role === "指導者" || role === "管理者";
  const items: AttendanceActionItem[] = [];

  const attendanceByPlayer = new Map<string, Attendance>();
  const attendanceBySelf = new Map<string, Attendance>();
  attendances.forEach((a) => {
    if (a.player_id) attendanceByPlayer.set(`${a.schedule_id}:${a.player_id}`, a);
    else if (a.user_id === userId) attendanceBySelf.set(a.schedule_id, a);
  });

  function pushIfNeeded(schedule: Schedule, targetLabel: string, attendance: Attendance | undefined) {
    const overdue = !!schedule.attendance_deadline && schedule.attendance_deadline < todayStr;
    if (!attendance) {
      items.push({
        scheduleId: schedule.id,
        scheduleTitle: schedule.title,
        scheduleDate: schedule.date,
        targetLabel,
        kind: "unanswered",
        overdue,
      });
      return;
    }
    if (attendance.status !== "出席") return;
    const { car, setup } = attendanceCarSetupRequired(schedule);
    if ((car && attendance.car === null) || (setup && attendance.setup_available === null)) {
      items.push({
        scheduleId: schedule.id,
        scheduleTitle: schedule.title,
        scheduleDate: schedule.date,
        targetLabel,
        kind: "carSetup",
        overdue,
      });
    }
  }

  for (const schedule of schedules) {
    const eligiblePlayers = myPlayers.filter((p) => isTargetEligible(p.grade, schedule.target_grade_min));
    eligiblePlayers.forEach((p) => {
      pushIfNeeded(schedule, p.name, attendanceByPlayer.get(`${schedule.id}:${p.id}`));
    });
    if (isStaff) {
      pushIfNeeded(schedule, "本人", attendanceBySelf.get(schedule.id));
    } else if (eligiblePlayers.length === 0) {
      pushIfNeeded(schedule, "自分", attendanceBySelf.get(schedule.id));
    }
  }

  // 期限超過(overdue)を優先し、同条件内では予定日が近い順に並べる。
  return items.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return a.scheduleDate.localeCompare(b.scheduleDate);
  });
}

// 「新着」カードの1件。お知らせ・チーム日報・コーチ日報を時系列統合するための共通形。
export interface DigestItem {
  id: string;
  source: "notice" | "report" | "coachNote";
  label: string;
  timestamp: string;
  href: string;
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

export function buildDigestItems(params: {
  notices: { id: string; title: string; created_at: string; sender_id: string | null }[];
  dailyReports: { id: string; body: string; created_at: string; updated_at: string; author_id: string | null }[];
  coachNotes: { id: string; body: string; created_at: string; updated_at: string; author_id: string | null }[];
  userId: string;
  noticeSeen: string;
  reportSeen: string;
  coachNoteSeen: string;
  includeCoachNotes: boolean;
}): DigestItem[] {
  const { notices, dailyReports, coachNotes, userId, noticeSeen, reportSeen, coachNoteSeen, includeCoachNotes } =
    params;
  const items: DigestItem[] = [];

  notices.forEach((n) => {
    if (n.sender_id === userId) return;
    if (n.created_at <= noticeSeen) return;
    items.push({ id: n.id, source: "notice", label: n.title, timestamp: n.created_at, href: `/notice/${n.id}` });
  });

  dailyReports.forEach((r) => {
    if (r.author_id === userId) return;
    const latest = r.updated_at > r.created_at ? r.updated_at : r.created_at;
    if (latest <= reportSeen) return;
    items.push({ id: r.id, source: "report", label: `チーム日報: ${truncate(r.body, 24)}`, timestamp: latest, href: "/report" });
  });

  if (includeCoachNotes) {
    coachNotes.forEach((r) => {
      if (r.author_id === userId) return;
      const latest = r.updated_at > r.created_at ? r.updated_at : r.created_at;
      if (latest <= coachNoteSeen) return;
      items.push({
        id: r.id,
        source: "coachNote",
        label: `コーチ日報: ${truncate(r.body, 24)}`,
        timestamp: latest,
        href: "/coach-note",
      });
    });
  }

  return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
