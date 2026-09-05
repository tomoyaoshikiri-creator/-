import { isTargetEligible } from "@/lib/format";
import { hasAiAnalysisAccess, hasCoachNoteAccess, hasKarteTabAccess, hasSportsTestAccess } from "@/lib/plan";
import { canViewKarte, canWriteCoachNote } from "@/lib/permissions";
import type { Attendance, Player, Role, Schedule, TeamPlan } from "@/lib/database.types";

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
  // 選手に紐づいていない一般・運営メンバーにも「自分」名義の出欠を求めるか
  // (チーム設定teams.require_unlinked_guardian_attendance、デフォルトtrue)。
  requireUnlinkedGuardianAttendance: boolean;
}): AttendanceActionItem[] {
  const { todayStr, role, userId, schedules, myPlayers, attendances, requireUnlinkedGuardianAttendance } = params;
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
    } else if (eligiblePlayers.length === 0 && requireUnlinkedGuardianAttendance) {
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

// 「今日のチーム情報」カード。本日が誕生日の在籍選手を表示する(年齢は出さない)。
// 該当者がいなければ呼び出し側でカードごと非表示にする。
export function computeTodayBirthdays<T extends { id: string; name: string; birthday: string | null }>(
  players: T[],
  todayStr: string,
): { id: string; name: string }[] {
  const todayMonthDay = todayStr.slice(5);
  return players.filter((p) => p.birthday && p.birthday.slice(5) === todayMonthDay).map((p) => ({ id: p.id, name: p.name }));
}

// 「直近の試合結果」カード。試合日から指定日数(仕様上は15日)以内のみ表示対象にする。
export function isWithinDisplayWindow(scheduleDate: string, todayStr: string, maxDays: number): boolean {
  const diffDays = Math.floor((new Date(todayStr).getTime() - new Date(scheduleDate).getTime()) / 86400000);
  return diffDays >= 0 && diffDays <= maxDays;
}

// 試合終了時刻(予定のend_time、未設定ならその日の23:59とみなす)から指定時間(仕様上は72時間)
// 以内かどうか。この時間以内なら「次の予定」の直後に一度だけ昇格表示する。
export function isWithinHoursSinceGameEnd(
  scheduleDate: string,
  endTime: string | null,
  nowIso: string,
  maxHours: number,
): boolean {
  const endClock = endTime ? endTime.slice(0, 5) : "23:59";
  const endMs = new Date(`${scheduleDate}T${endClock}:00`).getTime();
  const diffHours = (new Date(nowIso).getTime() - endMs) / (60 * 60 * 1000);
  return diffHours >= 0 && diffHours <= maxHours;
}

// 「アップグレード導線」カード。複数の上位機能を列挙せず、現ロールが使い得る(role側は
// 適格)のに現プランでは使えない機能のうち、最も導入しやすい(必要プランが低い)ものを
// 1件だけ選ぶ。役割・機能ごとの判定は既存のpermissions.ts/plan.tsの関数をそのまま使う。
export interface UpgradeCandidate {
  label: string;
  description: string;
  requiredPlan: TeamPlan;
}

const UPGRADE_CANDIDATES: (UpgradeCandidate & {
  roleEligible: (role: Role) => boolean;
  planOk: (plan: TeamPlan) => boolean;
})[] = [
  {
    label: "コーチ日報",
    description: "指導者・管理者だけで共有する日報",
    requiredPlan: "中間",
    roleEligible: canWriteCoachNote,
    planOk: hasCoachNoteAccess,
  },
  {
    label: "カルテ",
    description: "選手カルテ・チームカルテでスタッツを分析する",
    requiredPlan: "フル",
    roleEligible: canViewKarte,
    planOk: hasKarteTabAccess,
  },
  {
    label: "AI分析",
    description: "スタッツ・記録からAIが分析コメントを作成する",
    requiredPlan: "フルプラス",
    roleEligible: (role) => role === "管理者",
    planOk: hasAiAnalysisAccess,
  },
  {
    label: "スポーツテスト・検定",
    description: "スポーツテスト・検定の記録を管理する",
    requiredPlan: "Max",
    roleEligible: canViewKarte,
    planOk: hasSportsTestAccess,
  },
];

export function pickUpgradeCandidate(role: Role, plan: TeamPlan): UpgradeCandidate | null {
  const found = UPGRADE_CANDIDATES.find((c) => c.roleEligible(role) && !c.planOk(plan));
  if (!found) return null;
  const { label, description, requiredPlan } = found;
  return { label, description, requiredPlan };
}
