"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
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
import { LockedFeatureCard } from "@/components/PlanLock";
import type { GameMatch, Schedule } from "@/lib/database.types";

type LoadStatus = "loading" | "success" | "error";
type MyPlayer = { id: string; grade: string | null; name: string; birthday: string | null };

interface MatchWithSchedule extends Pick<GameMatch, "id" | "opponent" | "team_score" | "opponent_score"> {
  schedules: { date: string; end_time: string | null } | null;
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// スケルトンと実カードでpadding・行高を揃え、読み込み完了時のレイアウトシフトを防ぐ。
function CardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <Card>
      <div className="animate-pulse space-y-2">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="h-3.5 rounded bg-line" style={{ width: i === 0 ? "55%" : "85%" }} />
        ))}
      </div>
    </Card>
  );
}

function ErrorRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] text-ink-soft">読み込みに失敗しました</span>
        <button type="button" onClick={onRetry} className="text-[12px] font-bold text-orange flex-shrink-0">
          再試行
        </button>
      </div>
    </Card>
  );
}

// ホーム各カードの見出し。attnバリアント(「要対応」専用)は、左に赤い縦バー・右に件数を添える。
// バーと件数は状態(要対応の有無・件数)を表すためのもので、見出し文字自体は他カードと同じ
// text-heading色のまま(文字を赤くはしない)。カード内の「期限超過」赤ラベルとは独立。
// Roboto Mono(font-mono)はweight 500/700のみ読み込み済み(600は無し)のためboldを使う。
// 以前はtext-[13px]で本文(12.5〜14px)とほぼ同じ大きさだったため、見出しとして
// 目立たないというフィードバックを受けtext-[15px]・tracking広め・mb増に調整した。
function CardHeading({
  children,
  variant,
  count,
}: {
  children: React.ReactNode;
  variant?: "attn";
  count?: number;
}) {
  return (
    <div className="flex items-center mb-3">
      {variant === "attn" && (
        <span aria-hidden className="w-[3px] h-[20px] rounded-full bg-danger mr-2 flex-shrink-0" />
      )}
      <span className="font-mono font-bold text-[15px] tracking-[0.05em] text-heading">
        {children}
        {count !== undefined && (
          <>
            {" "}
            <span className="text-[12.5px] font-medium text-ink-soft">{count}件</span>
          </>
        )}
      </span>
    </div>
  );
}

export default function HomePage() {
  const { userId, teamId, role, plan, category, teamGoal } = useSession();
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
          ? await supabase.from("players").select("id, grade, sei, mei, birthday").in("id", playerIds).eq("status", "在籍")
          : { data: [], error: null };
      if (playersError) throw playersError;
      const myPlayerList: MyPlayer[] = (players ?? []).map((p) => ({
        id: p.id,
        grade: p.grade,
        name: playerFullName(p),
        birthday: p.birthday,
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
        }),
      );
      setUpcoming((schedules ?? []).filter((s) => s.date >= todayStr));
      setMyPlayers(myPlayerList);
      setScheduleStatus("success");
    } catch {
      setScheduleStatus("error");
    }
  }, [teamId, userId, role, todayStr]);

  const loadDigest = useCallback(async () => {
    setDigestStatus("loading");
    try {
      const supabase = createClient();
      const { data: seenRows, error: seenError } = await supabase
        .from("tab_last_seen")
        .select("*")
        .eq("user_id", userId);
      if (seenError) throw seenError;
      const seenMap: Partial<Record<"notice" | "report" | "coachNote", string>> = {};
      (seenRows ?? []).forEach((r) => {
        if (r.tab === "notice" || r.tab === "report" || r.tab === "coachNote") seenMap[r.tab] = r.seen_at;
      });
      const now = new Date().toISOString();
      const noticeSeen = seenMap.notice ?? now;
      const reportSeen = seenMap.report ?? now;
      const coachNoteSeen = seenMap.coachNote ?? now;

      const [noticesRes, reportsRes, coachRes] = await Promise.all([
        supabase
          .from("notices")
          .select("id, title, created_at, sender_id")
          .gt("created_at", noticeSeen)
          .neq("sender_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("daily_reports")
          .select("id, body, created_at, updated_at, author_id")
          .or(`created_at.gt.${reportSeen},updated_at.gt.${reportSeen}`)
          .neq("author_id", userId)
          .order("updated_at", { ascending: false })
          .limit(20),
        isStaff
          ? supabase
              .from("reports")
              .select("id, body, created_at, updated_at, author_id")
              .or(`created_at.gt.${coachNoteSeen},updated_at.gt.${coachNoteSeen}`)
              .neq("author_id", userId)
              .order("updated_at", { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (noticesRes.error) throw noticesRes.error;
      if (reportsRes.error) throw reportsRes.error;
      if (coachRes.error) throw coachRes.error;

      setDigestItems(
        buildDigestItems({
          notices: noticesRes.data ?? [],
          dailyReports: reportsRes.data ?? [],
          coachNotes: coachRes.data ?? [],
          userId,
          noticeSeen,
          reportSeen,
          coachNoteSeen,
          includeCoachNotes: isStaff,
        }),
      );
      setDigestStatus("success");
    } catch {
      setDigestStatus("error");
    }
  }, [userId, isStaff]);

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
        .eq("status", "在籍");
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
    <Card>
      <CardHeading>直近の試合結果</CardHeading>
      <Link href="/game/results">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[13px] font-bold truncate">vs {recentMatch.opponent ?? "(相手未設定)"}</div>
            <div className="text-[11.5px] text-ink-soft mt-0.5">{formatDateLabel(recentMatch.schedules.date)}</div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-mono font-extrabold text-[18px]">
              {recentMatch.team_score}-{recentMatch.opponent_score}
            </span>
            <span
              className={`text-[10.5px] font-bold px-2 py-1 rounded-full ${
                (recentMatch.team_score ?? 0) > (recentMatch.opponent_score ?? 0)
                  ? "bg-orange/10 text-orange"
                  : (recentMatch.team_score ?? 0) < (recentMatch.opponent_score ?? 0)
                    ? "bg-danger/10 text-danger"
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
        </div>
      </Link>
    </Card>
  );

  const upgradeCandidate = pickUpgradeCandidate(role, plan);

  const shortcutRows = isStaff
    ? [
        { href: "/coach-note", label: "コーチ日報を書く", show: hasCoachNoteAccess(plan) },
        { href: "/game", label: "試合を記録", show: canRecordGames(role) },
        { href: "/karte/team/skill-tests", label: "検定管理", show: canViewKarte(role) && hasSkillTestAccess(plan) },
        { href: "/karte/team", label: "カルテ・分析を開く", show: canViewKarte(role) && hasKarteTabAccess(plan) },
      ].filter((r) => r.show)
    : [];

  return (
    <PageShell header={<AppHeader title="ホーム" />}>
      {/* チーム目標。設定(/karte/team/goal、管理者のみ)が未設定ならカード自体を出さない。
          他のカードは白背景・グレー見出しの一覧の中に埋もれてしまうため、常設のバナー的な
          役割を意図してアクセントカラー(--orange、チームごとの基調色)で縁取り・背景を
          薄く着色し、他のカードより一段目立つ見た目にしている。 */}
      {teamGoal && (
        <div className="rounded-2xl border border-orange bg-orange/8 px-4 py-3.5 mb-2.5">
          <div className="font-mono font-bold text-[13px] tracking-[0.05em] text-orange mb-1.5">チーム目標</div>
          <div className="text-[16px] font-bold leading-relaxed whitespace-pre-wrap text-ink">{teamGoal}</div>
        </div>
      )}

      {/* 次の予定(+選手ショートカット)。0件でも「すべて確認済み」的な安心感のため表示し続ける。
          カレンダーはここには置かず、/scheduleへの入口のみに徹する。 */}
      {scheduleStatus === "loading" && <CardSkeleton lines={2} />}
      {scheduleStatus === "error" && <ErrorRetry onRetry={loadSchedule} />}
      {scheduleStatus === "success" && (
        <Card>
          <CardHeading>次の予定</CardHeading>
          {nextSchedule ? (
            <>
              <Link href={`/schedule/${nextSchedule.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-bold flex-shrink-0">{nextSchedule.title}</span>
                  <span className="text-[11.5px] text-ink-soft flex-1 min-w-0 truncate text-center">
                    {scheduleMeta(nextSchedule)}
                  </span>
                  <span
                    className={`flex-shrink-0 text-[10.5px] font-bold px-2 py-1 rounded-full ${
                      nextScheduleNeedsAction ? "bg-danger/10 text-danger" : "bg-line text-ink-soft"
                    }`}
                  >
                    {nextScheduleNeedsAction ? "要確認" : "回答済み"}
                  </span>
                </div>
                {nextSchedule.attendance_deadline && (
                  <div className="text-[10.5px] text-ink-soft mt-0.5">
                    回答期限: {formatDateLabel(nextSchedule.attendance_deadline)}
                  </div>
                )}
              </Link>
              {compressedSchedules.length > 0 && (
                <div className="mt-2 pt-2 border-t border-line space-y-1.5">
                  {compressedSchedules.map((s) => {
                    let timeLabel = "";
                    if (s.start_time && s.end_time) timeLabel = `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`;
                    else if (s.start_time) timeLabel = `${s.start_time.slice(0, 5)}〜`;
                    return (
                      <Link key={s.id} href={`/schedule/${s.id}`} className="flex items-center justify-between gap-2">
                        <span className="text-[11.5px] font-bold truncate">{s.title}</span>
                        <span className="flex-shrink-0 flex items-center gap-1.5 text-[10.5px] text-ink-soft tabular-nums">
                          <span className="min-w-[44px] text-right">{formatDateLabel(s.date)}</span>
                          <span className="min-w-[80px] text-right">{timeLabel || "時間未定"}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
              {myPlayers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-line">
                  {visiblePlayers.map((p) => (
                    <Link
                      key={p.id}
                      href={`/players/${p.id}`}
                      className="text-[10.5px] font-bold px-2 py-1 rounded-full bg-paper text-ink-soft"
                    >
                      {p.name}・{gradeLabel(p.grade, category)}
                    </Link>
                  ))}
                  {myPlayers.length >= 4 && (
                    <Link href="/players" className="text-[10.5px] font-bold px-2 py-1 rounded-full bg-paper text-ink-soft">
                      ほか{myPlayers.length - visiblePlayers.length}名
                    </Link>
                  )}
                </div>
              )}
              <Link href="/schedule" className="block text-[11.5px] text-ink-soft pt-2 mt-1 border-t border-line">
                予定をすべて見る
              </Link>
            </>
          ) : (
            <>
              <div className="text-[12.5px] text-ink-soft text-center py-3">直近の予定はありません</div>
              <Link
                href="/schedule"
                className="block text-center text-[12px] font-bold text-orange py-1.5 border-t border-line mt-1"
              >
                予定を見る
              </Link>
            </>
          )}
        </Card>
      )}

      {/* 要対応: 未回答・車出し/設営未回答の一覧。回答・確認そのものは既存の/scheduleに任せ、
          ここは入口のみ。0件(success)の場合はカードごと非表示にする。 */}
      {scheduleStatus === "loading" && <CardSkeleton lines={3} />}
      {scheduleStatus === "error" && <ErrorRetry onRetry={loadSchedule} />}
      {scheduleStatus === "success" && actionItems.length > 0 && (
        <Card>
          <CardHeading variant="attn" count={actionItems.length}>
            要対応
          </CardHeading>
          {visibleActionItems.map((item, i) => (
            <Link key={`${item.scheduleId}-${item.targetLabel}-${item.kind}`} href={`/schedule/${item.scheduleId}`}>
              <div className={`flex items-center justify-between py-2 ${i > 0 ? "border-t border-line" : ""}`}>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-bold flex items-center gap-1.5">
                    {item.overdue && <span className="text-[9.5px] font-bold text-danger flex-shrink-0">期限超過</span>}
                    <span className="truncate">{item.scheduleTitle}</span>
                  </div>
                  <div className="text-[11px] text-ink-soft mt-0.5">
                    {item.targetLabel}の{item.kind === "unanswered" ? "出欠が未回答です" : "車出し/設営が未回答です"}
                    {" ・ "}
                    {formatDateLabel(item.scheduleDate)}
                  </div>
                </div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
              </div>
            </Link>
          ))}
          {actionItemsRest > 0 && (
            <Link href="/schedule" className="block text-[11.5px] text-ink-soft pt-1.5 border-t border-line mt-1">
              ほか{actionItemsRest}件
            </Link>
          )}
        </Card>
      )}

      {/* 試合終了から72時間以内は、通常の位置(下記)ではなく「要対応」の直後に
          一度だけ昇格表示する。「次の予定」「要対応」は昇格時も常にこのカードより上に来る。 */}
      {elevateGameResult && gameResultNode}

      {/* 新着: お知らせ・チーム日報・(指導者/管理者のみ)コーチ日報の未読を時系列統合。
          ホームを開いただけでは既読にしない(既読化は各既存タブ側のmarkTabSeenのみで行う)。 */}
      {digestStatus === "loading" && <CardSkeleton lines={3} />}
      {digestStatus === "error" && <ErrorRetry onRetry={loadDigest} />}
      {digestStatus === "success" && (
        <Card>
          <CardHeading>新着</CardHeading>
          {visibleDigest.length > 0 ? (
            <>
              {visibleDigest.map((item, i) => (
                <Link key={item.id} href={item.href}>
                  <div className={`flex items-center justify-between py-2 ${i > 0 ? "border-t border-line" : ""}`}>
                    <span className="text-[12.5px] font-bold truncate">{item.label}</span>
                    <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0 ml-2" />
                  </div>
                </Link>
              ))}
              {digestRest > 0 && <div className="text-[11.5px] text-ink-soft pt-1.5 border-t border-line mt-1">ほか{digestRest}件</div>}
            </>
          ) : (
            <div className="text-[12.5px] text-ink-soft text-center py-3">新着はありません(すべて確認済みです)</div>
          )}
        </Card>
      )}

      {/* 今日のチーム情報: 本日誕生日の選手のみ(年齢は表示しない)。該当者がいなければ非表示。 */}
      {birthdaysStatus === "loading" && <CardSkeleton lines={1} />}
      {birthdaysStatus === "error" && <ErrorRetry onRetry={retryBirthdays} />}
      {birthdaysStatus === "success" && birthdays.length > 0 && (
        <Card>
          <CardHeading>今日のチーム情報</CardHeading>
          <div className="text-[12.5px]">🎂 {birthdays.map((b) => b.name).join("・")}さん、お誕生日おめでとうございます</div>
        </Card>
      )}

      {/* 作成ショートカット: 指導者・管理者のみ。有効な行が1つも無ければカード自体を出さない
          (チーム日報を書くはプラン制限が無いため、isStaffである限り常に最低1行は残る)。 */}
      {isStaff && shortcutRows.length > 0 && (
        <Card>
          <CardHeading>ショートカット</CardHeading>
          <div className="grid grid-cols-2 gap-2">
            {shortcutRows.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="text-center text-[12px] font-bold py-2.5 rounded-[10px] border border-line text-ink"
              >
                {r.label}
              </Link>
            ))}
          </div>
          {aiUsage && (
            <div className="text-[10.5px] text-ink-soft mt-2 text-center">
              AI分析: 今月あと{Math.max(0, aiUsage.limit - aiUsage.used)}回利用できます
            </div>
          )}
        </Card>
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
    </PageShell>
  );
}
