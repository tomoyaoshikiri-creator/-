"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { CardFooterLink } from "@/components/ui/Card";
import { CertificateIcon, ChevronRightIcon, CoachNoteIcon, GameIcon, KarteIcon } from "@/components/icons";
import { canRecordGames, canViewKarte, canWriteCoachNote } from "@/lib/permissions";
import { hasAiAnalysisAccess, hasCoachNoteAccess, hasKarteTabAccess, hasSkillTestAccess } from "@/lib/plan";
import { formatDateLabel, gradeLabel, playerFullName, scheduleMeta, todayDateStr } from "@/lib/format";
import {
  buildDigestItems,
  computeAttendanceActionItems,
  computeTodayBirthdays,
  isWithinDisplayWindow,
  isWithinHoursSinceGameEnd,
  pickUpgradeCandidate,
  type AttendanceActionItem,
  type DigestItem,
} from "@/lib/homeData";
import { computeUnseenClosedPollIds, computeUnseenCoachNoteIds, computeUnseenDailyReportIds, computeUnseenNoticeIds } from "@/lib/itemBadges";
import { LockedFeatureCard } from "@/components/PlanLock";
import { PlanLimitBanner } from "@/components/PlanLimitBanner";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import type { GameMatch, Schedule } from "@/lib/database.types";

type LoadStatus = "loading" | "success" | "error";
type MyPlayer = { id: string; grade: string | null; name: string; birthday: string | null };

interface MatchWithSchedule extends Pick<GameMatch, "id" | "opponent" | "team_score" | "opponent_score"> {
  schedules: { date: string; end_time: string | null } | null;
}

interface PendingSkillTestRequestRow {
  id: string;
  skill_test_id: string;
  target_level_label: string;
  created_at: string;
  requested_by: string;
  players: { sei: string; mei: string } | null;
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ホーム画面専用のカードの見た目(2026-10-25 再設計)。共通のcardClass(Card.tsx)は
// 他の移行済み画面(スケジュール一覧・お知らせ等)でも使われているため、今回の指示
// (「ホーム画面に限定した変更として、共通cardClassは変更しない」)に従い、ここだけの
// 定数として別に持つ。カード内余白16px・角丸14px・中立の枠線(チームカラーに依存しない)。
// カード間の余白はmb-*ではなく、呼び出し側のflexコンテナのgap-3(12px)で統一する
// (このクラス自体にはmargin-bottomを含めない)。
const homeCardClass = "bg-card border border-border-subtle rounded-card shadow-card p-4";

// 見出し左の縦バーの色。通常セクション(次の予定・新着・ショートカット等)は、
// チームカラーとも意味色とも無関係な中立色(ink-soft)に統一する(2026-10-25 再設計:
// 以前固定のスカイブルーを使っていたが、チームカラーとの混同を避けるため)。
// 「要対応」のような明確な警告状態のときだけCardHeadingのbarColorで上書きする。
const SECTION_BAR_COLOR = "var(--ink-soft)";

// スケルトンと実カードでpadding・行高を揃え、読み込み完了時のレイアウトシフトを防ぐ。
function CardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className={homeCardClass}>
      <div className="animate-pulse space-y-2">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="h-3.5 rounded bg-line" style={{ width: i === 0 ? "55%" : "85%" }} />
        ))}
      </div>
    </div>
  );
}

function ErrorRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={homeCardClass}>
      <div className="flex items-center justify-between">
        <span className="text-caption text-ink-soft">読み込みに失敗しました</span>
        <button type="button" onClick={onRetry} className="text-caption font-bold text-orange-text flex-shrink-0">
          再試行
        </button>
      </div>
    </div>
  );
}

// 「新着」の行に付ける、情報の種類を示す小さなタグ(2026-10-24 再設計)。検定承認待ち・
// 投票(未投票)は対応が必要な情報のためaccent色、それ以外(お知らせ・日報・投票結果)は
// 中立色にする。表示条件・取得データ自体は変更しない(buildDigestItemsのまま)。
const DIGEST_TAG: Record<DigestItem["source"], { label: string; accent: boolean }> = {
  notice: { label: "お知らせ", accent: false },
  report: { label: "日報", accent: false },
  coachNote: { label: "コーチ日報", accent: false },
  skillTestRequest: { label: "検定", accent: true },
  pollOpen: { label: "投票", accent: true },
  pollClosed: { label: "投票結果", accent: false },
};

function DigestTag({ source }: { source: DigestItem["source"] }) {
  const tag = DIGEST_TAG[source];
  return (
    <span
      className={`flex-shrink-0 font-mono text-[10.5px] font-bold px-1.5 py-0.5 rounded-lg ${
        tag.accent ? "bg-accent/15 text-accent-text" : "bg-line text-ink-soft"
      }`}
    >
      {tag.label}
    </span>
  );
}

// 「次の予定」内の各行。直近の1件・続く2件すべてを同じレイアウトで表示する
// (以前は直近の1件だけ日付・時間・場所をまとめた表示、続く2件は日付・時間だけの
// 別レイアウトになっていた不整合を解消)。日付・時間・場所はscheduleMeta()で1行にまとめ、
// 出欠の回答状態は全行に併記する。
function ScheduleRow({
  schedule,
  needsAction,
}: {
  schedule: Pick<Schedule, "id" | "title" | "date" | "start_time" | "end_time" | "place" | "is_all_day" | "attendance_deadline">;
  needsAction: boolean;
}) {
  return (
    <Link href={`/schedule/${schedule.id}`} className="flex min-h-tap flex-col justify-center gap-0.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold truncate">{schedule.title}</span>
        <span
          className={`flex-shrink-0 text-caption font-bold px-2 py-0.5 rounded-full ${
            needsAction ? "bg-danger/10 text-danger-text" : "bg-line text-ink-soft"
          }`}
        >
          {needsAction ? "要確認" : "回答済み"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption text-ink-soft truncate">{scheduleMeta(schedule)}</span>
        {schedule.attendance_deadline && (
          <span className="flex-shrink-0 text-caption text-ink-soft">
            回答期限 {formatDateLabel(schedule.attendance_deadline)}
          </span>
        )}
      </div>
    </Link>
  );
}

// ホーム各カードの見出し。左の縦バーは通常セクション共通でSECTION_BAR_COLOR(中立色、
// チームカラー・意味色いずれとも無関係)。「要対応」だけは緊急度を示すため赤(--danger)に
// する(barColorで個別に上書き)。件数(「要対応」専用)は状態(件数)を表すためのもので、
// 見出し文字自体は他カードと同じtext-heading色のまま(文字を赤くはしない)。カード内の
// 「期限超過」赤ラベルとは独立。
// plain=trueは誕生日のような受動的な情報専用(2026-10-24 再設計)。バーを省き文字も
// 控えめにすることで、要対応・次の予定・新着より意図的に目立たなくする。
// Roboto Mono(font-mono)はweight 500/700のみ読み込み済み(600は無し)のためboldを使う。
function CardHeading({
  children,
  count,
  barColor = SECTION_BAR_COLOR,
  plain = false,
}: {
  children: React.ReactNode;
  count?: number;
  barColor?: string;
  plain?: boolean;
}) {
  if (plain) {
    return <div className="text-caption font-bold text-ink-soft mb-1.5">{children}</div>;
  }
  return (
    <div className="flex items-center mb-3">
      <span aria-hidden className="w-[3px] h-[20px] rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: barColor }} />
      <span className="font-mono font-bold text-section tracking-[0.05em] text-heading">
        {children}
        {count !== undefined && (
          <>
            {" "}
            <span className="text-caption font-medium text-ink-soft">{count}件</span>
          </>
        )}
      </span>
    </div>
  );
}

export default function HomePage() {
  const { userId, teamId, role, plan, category, teamGoal, requireUnlinkedGuardianAttendance } = useSession();
  const isStaff = canWriteCoachNote(role);
  const todayStr = todayDateStr();
  const nowIso = new Date().toISOString();

  // 要対応・次の予定(+選手ショートカット)は同じ予定・選手データから導出するため、
  // 取得元は1つにまとめている(2回同じ問い合わせを投げるだけの分離はしない)。ただし
  // 表示上は別カードとして独立させ、新着カードの成否とは完全に無関係にする。
  const [scheduleStatus, setScheduleStatus] = useState<LoadStatus>("loading");
  const [actionItems, setActionItems] = useState<AttendanceActionItem[]>([]);
  const [upcoming, setUpcoming] = useState<Schedule[]>([]);
  const [myPlayers, setMyPlayers] = useState<MyPlayer[]>([]);

  const [digestStatus, setDigestStatus] = useState<LoadStatus>("loading");
  const [digestItems, setDigestItems] = useState<DigestItem[]>([]);

  // 今日のチーム情報(誕生日)。players_selectのRLSは指導者・管理者のみチーム全員を
  // 読めるため、指導者・管理者は独自に全選手を取得し、それ以外のロールはRLS上どのみち
  // 自分に紐づく選手しか読めないので、上のloadScheduleで既に取得済みのmyPlayersを
  // そのまま流用する(二重に同じ制約のクエリを投げない)。
  const [staffBirthdaysStatus, setStaffBirthdaysStatus] = useState<LoadStatus>(isStaff ? "loading" : "success");
  const [staffBirthdays, setStaffBirthdays] = useState<{ id: string; name: string }[]>([]);

  const [gameResultStatus, setGameResultStatus] = useState<LoadStatus>("loading");
  const [recentMatch, setRecentMatch] = useState<MatchWithSchedule | null>(null);

  const [aiUsage, setAiUsage] = useState<{ used: number; limit: number } | null>(null);

  const loadSchedule = useCallback(async () => {
    setScheduleStatus("loading");
    try {
      const supabase = createClient();
      const from = addDaysStr(todayStr, -14);
      const to = addDaysStr(todayStr, 60);
      const [{ data: schedules, error: scheduleError }, { data: links, error: linksError }] = await Promise.all([
        supabase
          .from("schedules")
          .select("*")
          .eq("team_id", teamId)
          .gte("date", from)
          .lte("date", to)
          .order("date", { ascending: true })
          .order("start_time", { ascending: true, nullsFirst: false }),
        supabase.from("player_guardians").select("player_id").eq("profile_id", userId),
      ]);
      if (scheduleError) throw scheduleError;
      if (linksError) throw linksError;

      const playerIds = (links ?? []).map((l) => l.player_id);
      const { data: players, error: playersError } =
        playerIds.length > 0
          ? await supabase
              .from("players")
              .select("id, grade, sei, mei, birthday, birthday_visible")
              .in("id", playerIds)
              .eq("status", "在籍")
          : { data: [], error: null };
      if (playersError) throw playersError;
      const myPlayerList: MyPlayer[] = (players ?? []).map((p) => ({
        id: p.id,
        grade: p.grade,
        name: playerFullName(p),
        // 出欠関連の集計(computeAttendanceActionItems)には誕生日非公開の選手も含める必要があるため、
        // クエリ自体は絞り込まず、誕生日カード用のbirthdayフィールドだけをここでマスクする
        // (list_roster_players()のcase whenと同じ考え方)。
        birthday: p.birthday_visible ? p.birthday : null,
      }));

      const scheduleIds = (schedules ?? []).map((s) => s.id);
      const { data: attendances, error: attendanceError } =
        scheduleIds.length > 0
          ? await supabase.from("attendances").select("*").in("schedule_id", scheduleIds)
          : { data: [], error: null };
      if (attendanceError) throw attendanceError;

      const myPlayerIds = new Set(myPlayerList.map((p) => p.id));
      const relevantAttendances = (attendances ?? []).filter(
        (a) => (a.player_id && myPlayerIds.has(a.player_id)) || (!a.player_id && a.user_id === userId),
      );

      setActionItems(
        computeAttendanceActionItems({
          todayStr,
          role,
          userId,
          schedules: schedules ?? [],
          myPlayers: myPlayerList,
          attendances: relevantAttendances,
          requireUnlinkedGuardianAttendance,
        }),
      );
      setUpcoming((schedules ?? []).filter((s) => s.date >= todayStr));
      setMyPlayers(myPlayerList);
      setScheduleStatus("success");
    } catch {
      setScheduleStatus("error");
    }
  }, [teamId, userId, role, todayStr, requireUnlinkedGuardianAttendance]);

  const loadDigest = useCallback(async () => {
    setDigestStatus("loading");
    try {
      const supabase = createClient();
      // 検定の承認待ちキューは、指導者・管理者なら誰でも承認できるため、指導者・管理者全員の
      // ダッシュボードに合流させる(既読管理はせず、承認・却下されるまで表示し続ける)。
      const includeSkillTestRequests = isStaff && hasSkillTestAccess(plan);
      // お知らせ・日報・コーチ日報は、投稿ごとの既読管理(item_last_seen)ベースで未読判定する
      // (タブの赤丸バッジと同じ仕組み。詳細ページを開けば既読になる)。
      const [unseenNoticeIds, unseenDailyReportIds, unseenCoachNoteIds, unseenClosedPollIds] = await Promise.all([
        computeUnseenNoticeIds(userId),
        computeUnseenDailyReportIds(userId),
        isStaff ? computeUnseenCoachNoteIds(userId) : Promise.resolve(new Set<string>()),
        computeUnseenClosedPollIds(userId),
      ]);

      const [noticesRes, reportsRes, coachRes, skillTestRes, openPollsRes, myVotesRes, closedPollsRes] = await Promise.all([
        supabase
          .from("notices")
          .select("id, title, created_at, updated_at, sender_id")
          .neq("sender_id", userId)
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("daily_reports")
          .select("id, body, created_at, updated_at, author_id")
          .neq("author_id", userId)
          .order("updated_at", { ascending: false })
          .limit(20),
        isStaff
          ? supabase
              .from("reports")
              .select("id, body, created_at, updated_at, author_id")
              .neq("author_id", userId)
              .order("updated_at", { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [], error: null }),
        includeSkillTestRequests
          ? supabase
              .from("skill_test_promotion_requests")
              .select("id, skill_test_id, target_level_label, created_at, requested_by, players(sei, mei)")
              .eq("status", "pending")
              .order("created_at", { ascending: false })
              .limit(20)
              .returns<PendingSkillTestRequestRow[]>()
          : Promise.resolve({ data: [] as PendingSkillTestRequestRow[], error: null }),
        supabase.from("polls").select("id, title, allowed_roles, created_at").eq("status", "open"),
        supabase.from("poll_votes").select("poll_id").eq("voter_id", userId),
        unseenClosedPollIds.size > 0
          ? supabase.from("polls").select("id, title, closed_at, created_at").in("id", Array.from(unseenClosedPollIds))
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (noticesRes.error) throw noticesRes.error;
      if (reportsRes.error) throw reportsRes.error;
      if (coachRes.error) throw coachRes.error;
      if (skillTestRes.error) throw skillTestRes.error;
      // 投票関連のクエリは、既存のお知らせ・日報等の新着表示を道連れにして壊さないよう
      // 失敗してもthrowしない(dataのnullish fallbackで「投票は0件扱い」に留める)。

      setDigestItems(
        buildDigestItems({
          notices: noticesRes.data ?? [],
          dailyReports: reportsRes.data ?? [],
          coachNotes: coachRes.data ?? [],
          skillTestRequests: (skillTestRes.data ?? []).map((r) => ({
            id: r.id,
            playerName: r.players ? playerFullName(r.players) : "選手",
            targetLevelLabel: r.target_level_label,
            skillTestId: r.skill_test_id,
            createdAt: r.created_at,
            requestedBy: r.requested_by,
          })),
          openPolls: (openPollsRes.data ?? []).map((p) => ({
            id: p.id,
            title: p.title,
            allowedRoles: p.allowed_roles,
            createdAt: p.created_at,
          })),
          votedPollIds: (myVotesRes.data ?? []).map((v) => v.poll_id),
          myRole: role,
          closedPollsUnseen: (closedPollsRes.data ?? []).map((p) => ({
            id: p.id,
            title: p.title,
            closedAt: p.closed_at ?? p.created_at,
          })),
          userId,
          unseenNoticeIds,
          unseenDailyReportIds,
          unseenCoachNoteIds,
          includeCoachNotes: isStaff,
        }),
      );
      setDigestStatus("success");
    } catch {
      setDigestStatus("error");
    }
  }, [userId, isStaff, plan, role]);

  const loadStaffBirthdays = useCallback(async () => {
    if (!isStaff) {
      setStaffBirthdaysStatus("success");
      return;
    }
    setStaffBirthdaysStatus("loading");
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("players")
        .select("id, sei, mei, birthday")
        .eq("team_id", teamId)
        .eq("status", "在籍")
        .eq("birthday_visible", true);
      if (error) throw error;
      setStaffBirthdays(
        computeTodayBirthdays((data ?? []).map((p) => ({ id: p.id, name: playerFullName(p), birthday: p.birthday })), todayStr),
      );
      setStaffBirthdaysStatus("success");
    } catch {
      setStaffBirthdaysStatus("error");
    }
  }, [isStaff, teamId, todayStr]);

  const loadGameResult = useCallback(async () => {
    setGameResultStatus("loading");
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("game_matches")
        .select("id, opponent, team_score, opponent_score, schedules(date, end_time)")
        .eq("team_id", teamId)
        .not("team_score", "is", null)
        .not("opponent_score", "is", null)
        .order("date", { foreignTable: "schedules", ascending: false })
        .limit(3)
        .returns<MatchWithSchedule[]>();
      if (error) throw error;
      const latest = (data ?? []).find((m) => m.schedules && isWithinDisplayWindow(m.schedules.date, todayStr, 15));
      setRecentMatch(latest ?? null);
      setGameResultStatus("success");
    } catch {
      setGameResultStatus("error");
    }
  }, [teamId, todayStr]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  useEffect(() => {
    loadDigest();
  }, [loadDigest]);

  useEffect(() => {
    loadStaffBirthdays();
  }, [loadStaffBirthdays]);

  useEffect(() => {
    loadGameResult();
  }, [loadGameResult]);

  // AI分析の残数は「作成ショートカット」内の補助テキストに過ぎないため、取得失敗時は
  // 単に表示しないだけに留め、カード全体をエラー扱いにはしない。
  useEffect(() => {
    if (!(role === "管理者" && hasAiAnalysisAccess(plan))) return;
    (async () => {
      try {
        const res = await fetch("/api/ai-analysis");
        if (!res.ok) return;
        const json = await res.json();
        setAiUsage({ used: json.usedThisMonth, limit: json.monthlyLimit });
      } catch {
        // 補助テキストなので握りつぶす
      }
    })();
  }, [role, plan]);

  const visibleActionItems = actionItems.slice(0, 3);
  const actionItemsRest = actionItems.length - visibleActionItems.length;
  const nextSchedule = upcoming[0];
  const compressedSchedules = upcoming.slice(1, 3);
  const nextScheduleNeedsAction = nextSchedule ? actionItems.some((i) => i.scheduleId === nextSchedule.id) : false;
  const visibleDigest = digestItems.slice(0, 3);
  const digestRest = digestItems.length - visibleDigest.length;
  const visiblePlayers = myPlayers.length >= 4 ? myPlayers.slice(0, 3) : myPlayers;

  const nonStaffBirthdays = computeTodayBirthdays(myPlayers, todayStr);
  const birthdays = isStaff ? staffBirthdays : nonStaffBirthdays;
  const birthdaysStatus = isStaff ? staffBirthdaysStatus : scheduleStatus;
  const retryBirthdays = isStaff ? loadStaffBirthdays : loadSchedule;

  const showGameResult = gameResultStatus === "success" && !!recentMatch?.schedules;
  const elevateGameResult =
    showGameResult && recentMatch?.schedules
      ? isWithinHoursSinceGameEnd(recentMatch.schedules.date, recentMatch.schedules.end_time, nowIso, 72)
      : false;
  const gameResultNode = showGameResult && recentMatch?.schedules && (
    <div className={homeCardClass}>
      <CardHeading>直近の試合結果</CardHeading>
      <Link href="/game/results" className="flex min-h-tap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold truncate">vs {recentMatch.opponent ?? "(相手未設定)"}</div>
          <div className="text-caption text-ink-soft mt-0.5">{formatDateLabel(recentMatch.schedules.date)}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-mono font-extrabold text-[18px]">
            {recentMatch.team_score}-{recentMatch.opponent_score}
          </span>
          <span
            className={`text-caption font-bold px-2 py-1 rounded-full ${
              (recentMatch.team_score ?? 0) > (recentMatch.opponent_score ?? 0)
                ? "bg-orange/10 text-orange-text"
                : (recentMatch.team_score ?? 0) < (recentMatch.opponent_score ?? 0)
                  ? "bg-danger/10 text-danger-text"
                  : "bg-line text-ink-soft"
            }`}
          >
            {(recentMatch.team_score ?? 0) > (recentMatch.opponent_score ?? 0)
              ? "勝ち"
              : (recentMatch.team_score ?? 0) < (recentMatch.opponent_score ?? 0)
                ? "負け"
                : "引き分け"}
          </span>
        </div>
      </Link>
    </div>
  );

  const upgradeCandidate = pickUpgradeCandidate(role, plan);

  const shortcutRows = isStaff
    ? [
        { href: "/coach-note", label: "コーチ日報を書く", icon: CoachNoteIcon, show: hasCoachNoteAccess(plan) },
        { href: "/game", label: "試合を記録", icon: GameIcon, show: canRecordGames(role) },
        {
          href: "/karte/team/skill-tests",
          label: "検定管理",
          icon: CertificateIcon,
          show: canViewKarte(role) && hasSkillTestAccess(plan),
        },
        { href: "/karte/team", label: "カルテ・分析を開く", icon: KarteIcon, show: canViewKarte(role) && hasKarteTabAccess(plan) },
      ].filter((r) => r.show)
    : [];

  return (
    <PageShell header={<AppHeader title="ホーム" />}>
      <PlanLimitBanner />
      <OnboardingChecklist />

      {/* チーム目標。設定(/karte/team/goal、管理者のみ)が未設定ならカード自体を出さない。
          他のカードと同じ角丸・枠線幅にしつつ、チームカラー(--orange、teams.theme_primary)の
          薄い背景で常設バナーとしての一段目立つ見た目を保つ(2026-10-25再設計: 以前の太枠は
          「強い枠線に依存しない」指示に沿い1pxへ変更)。タップ不可のため矢印等は付けない。 */}
      {teamGoal && (
        <div className="rounded-card border border-orange bg-orange/8 p-4 mb-3">
          <div className="font-mono font-bold text-caption tracking-[0.05em] text-orange-text mb-0.5">チーム目標</div>
          <div className="text-[16px] font-bold leading-relaxed whitespace-pre-wrap text-ink">{teamGoal}</div>
        </div>
      )}

      {/* 次の予定・要対応(主要情報)と、新着・誕生日・ショートカット・試合結果・アップグレード
          (補助情報)を役割ごとに分け、タブレット・PC幅ではコンテナクエリ(@container)で
          2カラムに配置する(2026-10-25再設計)。スマートフォン幅(コンテナ幅600px未満)では
          単一カラムで、合意済みの表示順(次の予定→要対応→(昇格時のみ試合結果)→新着→
          誕生日→ショートカット→試合結果→アップグレード)のまま縦に並ぶ。 */}
      <div className="@container">
        <div className="flex flex-col gap-3 @[600px]:grid @[600px]:grid-cols-2 @[600px]:items-start">
          {/* 主要情報列: 次の予定・要対応(・昇格時のみ直近の試合結果) */}
          <div className="flex flex-col gap-3">
            {/* 次の予定。0件でも「すべて確認済み」的な安心感のため表示し続ける。
                カレンダーはここには置かず、/scheduleへの入口のみに徹する。 */}
            {scheduleStatus === "loading" && <CardSkeleton lines={2} />}
            {scheduleStatus === "error" && <ErrorRetry onRetry={loadSchedule} />}
            {scheduleStatus === "success" && (
              <div className={homeCardClass}>
                <CardHeading>次の予定</CardHeading>
                {nextSchedule ? (
                  <>
                    <div className="divide-y divide-line">
                      <ScheduleRow schedule={nextSchedule} needsAction={nextScheduleNeedsAction} />
                      {compressedSchedules.map((s) => (
                        <ScheduleRow key={s.id} schedule={s} needsAction={actionItems.some((i) => i.scheduleId === s.id)} />
                      ))}
                    </div>
                    {myPlayers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-line">
                        {visiblePlayers.map((p) => (
                          <Link
                            key={p.id}
                            href={`/karte/players/${p.id}`}
                            className="text-caption font-bold px-2 py-1 rounded-full bg-paper text-ink-soft"
                          >
                            {p.name}・{gradeLabel(p.grade, category)}
                          </Link>
                        ))}
                        {myPlayers.length >= 4 && (
                          <Link href="/karte/players" className="text-caption font-bold px-2 py-1 rounded-full bg-paper text-ink-soft">
                            ほか{myPlayers.length - visiblePlayers.length}名
                          </Link>
                        )}
                      </div>
                    )}
                    <CardFooterLink href="/schedule">予定をすべて見る</CardFooterLink>
                  </>
                ) : (
                  <>
                    <div className="text-caption text-ink-soft text-center py-3">直近の予定はありません</div>
                    <CardFooterLink href="/schedule">予定を見る</CardFooterLink>
                  </>
                )}
              </div>
            )}

            {/* 要対応: 未回答・車出し/設営未回答の一覧。回答・確認そのものは既存の/scheduleに
                任せ、ここは入口のみ。0件(success)のときはカードを畳んだコンパクトな完了表示に
                する(以前はカード自体が非表示だったが、「すべて確認済み」の安心材料を示すよう
                変更)。期限超過の行は薄い警告色の背景で視認性を上げる(行アイコンは追加しない
                方針のため、文字情報と背景色のみで表現)。 */}
            {scheduleStatus === "loading" && <CardSkeleton lines={3} />}
            {scheduleStatus === "error" && <ErrorRetry onRetry={loadSchedule} />}
            {scheduleStatus === "success" && actionItems.length > 0 && (
              <div className={homeCardClass}>
                <CardHeading count={actionItems.length} barColor="var(--danger)">
                  要対応
                </CardHeading>
                <div className="divide-y divide-line">
                  {visibleActionItems.map((item) => (
                    <Link
                      key={`${item.scheduleId}-${item.targetLabel}-${item.kind}`}
                      href={`/schedule/${item.scheduleId}`}
                      className={`flex min-h-tap items-center justify-between gap-2 py-2 px-2 -mx-2 rounded-control ${
                        item.overdue ? "bg-danger/5" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold flex items-center gap-1.5">
                          {item.overdue && <span className="text-caption font-bold text-danger-text flex-shrink-0">期限超過</span>}
                          <span className="truncate">{item.scheduleTitle}</span>
                        </div>
                        <div className="text-caption text-ink-soft mt-0.5 truncate">
                          {item.targetLabel}の{item.kind === "unanswered" ? "出欠が未回答です" : "車出し/設営が未回答です"}
                          {" ・ "}
                          {formatDateLabel(item.scheduleDate)}
                        </div>
                      </div>
                      <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
                    </Link>
                  ))}
                </div>
                <CardFooterLink href="/schedule">
                  {actionItemsRest > 0 ? `${visibleActionItems.length}件を表示中・ほか${actionItemsRest}件を確認` : "予定で確認する"}
                </CardFooterLink>
              </div>
            )}
            {scheduleStatus === "success" && actionItems.length === 0 && (
              <div className={`${homeCardClass} flex min-h-tap items-center`}>
                <span className="text-sm font-bold text-ink-soft">要対応はありません</span>
              </div>
            )}

            {/* 試合終了から72時間以内は、通常の位置(補助情報列)ではなく主要情報列の末尾に
                一度だけ昇格表示する。 */}
            {elevateGameResult && gameResultNode}
          </div>

          {/* 補助情報列: 新着・誕生日・ショートカット・試合結果(通常)・アップグレード */}
          <div className="flex flex-col gap-3">
            {/* 新着: お知らせ・チーム日報・(指導者/管理者のみ)コーチ日報の未読を時系列統合。
                ホームを開いただけでは既読にしない(既読化は各投稿の詳細ページを開いた時のみ
                行う)。種類タグ(お知らせ/日報/コーチ日報/検定/投票)を併記する。表示条件・
                対象データ(buildDigestItems)自体は変更していない。 */}
            {digestStatus === "loading" && <CardSkeleton lines={3} />}
            {digestStatus === "error" && <ErrorRetry onRetry={loadDigest} />}
            {digestStatus === "success" && (
              <div className={homeCardClass}>
                <CardHeading count={digestItems.length > 0 ? digestItems.length : undefined}>新着</CardHeading>
                {visibleDigest.length > 0 ? (
                  <>
                    <div className="divide-y divide-line">
                      {visibleDigest.map((item) => (
                        <Link key={item.id} href={item.href} className="flex min-h-tap items-center justify-between gap-2 py-2">
                          <span className="flex items-center gap-1.5 min-w-0 flex-1">
                            <DigestTag source={item.source} />
                            <span className="text-sm font-bold truncate">{item.label}</span>
                          </span>
                          <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
                        </Link>
                      ))}
                    </div>
                    {digestRest > 0 && (
                      <div className="text-caption text-ink-soft pt-2 mt-1 border-t border-line">ほか{digestRest}件あります</div>
                    )}
                  </>
                ) : (
                  <div className="text-caption text-ink-soft text-center py-3">新着はありません(すべて確認済みです)</div>
                )}
              </div>
            )}

            {/* 今日のチーム情報: 本日誕生日の選手のみ(年齢は表示しない)。該当者がいなければ
                非表示。要対応・次の予定・新着と違い対応を必要としない受動的な情報のため、
                見出しの縦バーを外し(CardHeading plain)、他カードより意図的に目立たなくする。 */}
            {birthdaysStatus === "loading" && <CardSkeleton lines={1} />}
            {birthdaysStatus === "error" && <ErrorRetry onRetry={retryBirthdays} />}
            {birthdaysStatus === "success" && birthdays.length > 0 && (
              <div className={homeCardClass}>
                <CardHeading plain>今日のチーム情報</CardHeading>
                <div className="text-sm">🎂 {birthdays.map((b) => b.name).join("・")}さん、お誕生日おめでとうございます</div>
              </div>
            )}

            {/* 作成ショートカット: 指導者・管理者のみ。有効な行が1つも無ければカード自体を
                出さない(チーム日報を書くはプラン制限が無いため、isStaffである限り常に最低
                1行は残る)。アイコン+ラベルの縦積みレイアウト。利用頻度による強弱は付けず、
                4つとも同じ視覚的重要度にする(2026-10-25再設計)。配色はチームカラー連動
                (--orange系、teams.theme_primaryで上書きされる)に統一し、淡い背景+
                アイコン/文字のみ着色する(全面塗りつぶしにはしない)。 */}
            {isStaff && shortcutRows.length > 0 && (
              <div className={homeCardClass}>
                <CardHeading>ショートカット</CardHeading>
                <div className="grid grid-cols-2 gap-2">
                  {shortcutRows.map((r) => (
                    <Link
                      key={r.href}
                      href={r.href}
                      className="flex min-h-tap flex-col items-center justify-center gap-1 rounded-control border border-orange/25 bg-orange/5 text-orange-text py-3 px-2"
                    >
                      <r.icon className="w-5 h-5" />
                      <span className="text-caption font-bold text-center">{r.label}</span>
                    </Link>
                  ))}
                </div>
                {aiUsage && (
                  <div className="text-caption text-ink-soft mt-2 text-center">
                    AI分析: 今月あと{Math.max(0, aiUsage.limit - aiUsage.used)}回利用できます
                  </div>
                )}
              </div>
            )}

            {/* 直近の試合結果(通常位置)。72時間以内の昇格表示と両方に出ることはない。 */}
            {gameResultStatus === "loading" && <CardSkeleton lines={2} />}
            {gameResultStatus === "error" && <ErrorRetry onRetry={loadGameResult} />}
            {!elevateGameResult && gameResultNode}

            {/* アップグレード導線: 現ロールが使い得るのに現プランでは使えない機能のうち1件だけを案内する。 */}
            {upgradeCandidate && (
              <LockedFeatureCard
                label={upgradeCandidate.label}
                description={upgradeCandidate.description}
                requiredPlan={upgradeCandidate.requiredPlan}
              />
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
