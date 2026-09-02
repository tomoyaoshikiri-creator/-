"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { canWriteCoachNote } from "@/lib/permissions";
import { formatDateLabel, gradeLabel, playerFullName, scheduleMeta, todayDateStr } from "@/lib/format";
import { buildDigestItems, computeAttendanceActionItems, type AttendanceActionItem, type DigestItem } from "@/lib/homeData";
import type { Schedule } from "@/lib/database.types";

type LoadStatus = "loading" | "success" | "error";
type MyPlayer = { id: string; grade: string | null; name: string };

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

export default function HomePage() {
  const { userId, teamId, role, category } = useSession();
  const isStaff = canWriteCoachNote(role);
  const todayStr = todayDateStr();

  // 要対応・次の予定(+選手ショートカット)は同じ予定・選手データから導出するため、
  // 取得元は1つにまとめている(2回同じ問い合わせを投げるだけの分離はしない)。ただし
  // 表示上は別カードとして独立させ、新着カードの成否とは完全に無関係にする。
  const [scheduleStatus, setScheduleStatus] = useState<LoadStatus>("loading");
  const [actionItems, setActionItems] = useState<AttendanceActionItem[]>([]);
  const [upcoming, setUpcoming] = useState<Schedule[]>([]);
  const [myPlayers, setMyPlayers] = useState<MyPlayer[]>([]);

  const [digestStatus, setDigestStatus] = useState<LoadStatus>("loading");
  const [digestItems, setDigestItems] = useState<DigestItem[]>([]);

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
          .order("date", { ascending: true }),
        supabase.from("player_guardians").select("player_id").eq("profile_id", userId),
      ]);
      if (scheduleError) throw scheduleError;
      if (linksError) throw linksError;

      const playerIds = (links ?? []).map((l) => l.player_id);
      const { data: players, error: playersError } =
        playerIds.length > 0
          ? await supabase.from("players").select("id, grade, sei, mei").in("id", playerIds).eq("status", "在籍")
          : { data: [], error: null };
      if (playersError) throw playersError;
      const myPlayerList: MyPlayer[] = (players ?? []).map((p) => ({ id: p.id, grade: p.grade, name: playerFullName(p) }));

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

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  useEffect(() => {
    loadDigest();
  }, [loadDigest]);

  const visibleActionItems = actionItems.slice(0, 3);
  const actionItemsRest = actionItems.length - visibleActionItems.length;
  const nextSchedule = upcoming[0];
  const compressedSchedules = upcoming.slice(1, 3);
  const nextScheduleNeedsAction = nextSchedule ? actionItems.some((i) => i.scheduleId === nextSchedule.id) : false;
  const visibleDigest = digestItems.slice(0, 3);
  const digestRest = digestItems.length - visibleDigest.length;
  const visiblePlayers = myPlayers.length >= 4 ? myPlayers.slice(0, 3) : myPlayers;

  return (
    <PageShell header={<AppHeader title="ホーム" />}>
      {/* 要対応: 未回答・車出し/設営未回答の一覧。回答・確認そのものは既存の/scheduleに任せ、
          ここは入口のみ。0件(success)の場合はカードごと非表示にする。 */}
      {scheduleStatus === "loading" && <CardSkeleton lines={3} />}
      {scheduleStatus === "error" && <ErrorRetry onRetry={loadSchedule} />}
      {scheduleStatus === "success" && actionItems.length > 0 && (
        <Card>
          <div className="font-bold text-[13px] mb-1.5">要対応</div>
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

      {/* 次の予定(+選手ショートカット)。0件でも「すべて確認済み」的な安心感のため表示し続ける。
          カレンダーはここには置かず、/scheduleへの入口のみに徹する。 */}
      {scheduleStatus === "loading" && <CardSkeleton lines={2} />}
      {scheduleStatus === "error" && <ErrorRetry onRetry={loadSchedule} />}
      {scheduleStatus === "success" && (
        <Card>
          <div className="font-bold text-[13px] mb-1.5">次の予定</div>
          {nextSchedule ? (
            <>
              <Link href={`/schedule/${nextSchedule.id}`}>
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold truncate">{nextSchedule.title}</div>
                    <div className="text-[11.5px] text-ink-soft mt-0.5">{scheduleMeta(nextSchedule)}</div>
                    {nextSchedule.attendance_deadline && (
                      <div className="text-[10.5px] text-ink-soft mt-0.5">
                        回答期限: {formatDateLabel(nextSchedule.attendance_deadline)}
                      </div>
                    )}
                  </div>
                  <span
                    className={`flex-shrink-0 text-[10.5px] font-bold px-2 py-1 rounded-full ${
                      nextScheduleNeedsAction ? "bg-danger/10 text-danger" : "bg-line text-ink-soft"
                    }`}
                  >
                    {nextScheduleNeedsAction ? "要確認" : "回答済み"}
                  </span>
                </div>
              </Link>
              {compressedSchedules.length > 0 && (
                <div className="mt-2 pt-2 border-t border-line space-y-1.5">
                  {compressedSchedules.map((s) => (
                    <Link key={s.id} href={`/schedule/${s.id}`} className="flex items-center justify-between">
                      <span className="text-[11.5px] font-bold truncate">{s.title}</span>
                      <span className="text-[10.5px] text-ink-soft flex-shrink-0 ml-2">{formatDateLabel(s.date)}</span>
                    </Link>
                  ))}
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

      {/* 新着: お知らせ・チーム日報・(指導者/管理者のみ)コーチ日報の未読を時系列統合。
          ホームを開いただけでは既読にしない(既読化は各既存タブ側のmarkTabSeenのみで行う)。 */}
      {digestStatus === "loading" && <CardSkeleton lines={3} />}
      {digestStatus === "error" && <ErrorRetry onRetry={loadDigest} />}
      {digestStatus === "success" && (
        <Card>
          <div className="font-bold text-[13px] mb-1.5">新着</div>
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
    </PageShell>
  );
}
