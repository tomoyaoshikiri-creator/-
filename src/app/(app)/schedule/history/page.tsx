"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { EmptyState, SectionLabel } from "@/components/ui/Card";
import { groupByMonth, todayDateStr } from "@/lib/format";
import type { Attendance, Schedule } from "@/lib/database.types";
import { ScheduleCard } from "../ScheduleCard";

// 1回のDB取得件数の上限。従来は範囲を絞らず全件取得しており、チームの活動年数が
// 長くなるほど取得件数が際限なく伸びる問題があった(docs/load-handling-todo.md)。
const SCHEDULE_HISTORY_PAGE_SIZE = 30;

export default function ScheduleHistoryPage() {
  const { userId } = useSession();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [attendances, setAttendances] = useState<Record<string, Attendance>>({});
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // 出欠(attendances)は読み込み済みscheduleの分だけ取得する。
  const loadAttendances = useCallback(
    async (
      supabase: ReturnType<typeof createClient>,
      scheduleIds: string[],
    ): Promise<Record<string, Attendance>> => {
      if (scheduleIds.length === 0) return {};
      const { data: att } = await supabase
        .from("attendances")
        .select("*")
        .eq("user_id", userId)
        .in("schedule_id", scheduleIds);
      const map: Record<string, Attendance> = {};
      (att ?? []).forEach((a) => {
        map[a.schedule_id] = a;
      });
      return map;
    },
    [userId],
  );

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const { data: sch } = await supabase
      .from("schedules")
      .select("*")
      .lt("date", todayDateStr())
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .limit(SCHEDULE_HISTORY_PAGE_SIZE + 1);
    const page = (sch ?? []).slice(0, SCHEDULE_HISTORY_PAGE_SIZE);
    setHasMore((sch?.length ?? 0) > SCHEDULE_HISTORY_PAGE_SIZE);
    setSchedules(page);
    setAttendances(await loadAttendances(supabase, page.map((s) => s.id)));
    setLoading(false);
  }, [loadAttendances]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    if (schedules.length === 0 || loadingMore) return;
    setLoadingMore(true);
    const supabase = createClient();
    const cursor = schedules[schedules.length - 1];
    const { data: sch } = await supabase
      .from("schedules")
      .select("*")
      .lt("date", todayDateStr())
      .or(`date.lt.${cursor.date},and(date.eq.${cursor.date},id.lt.${cursor.id})`)
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .limit(SCHEDULE_HISTORY_PAGE_SIZE + 1);
    const page = (sch ?? []).slice(0, SCHEDULE_HISTORY_PAGE_SIZE);
    setHasMore((sch?.length ?? 0) > SCHEDULE_HISTORY_PAGE_SIZE);
    if (page.length > 0) {
      setSchedules((prev) => [...prev, ...page]);
      const newAttendances = await loadAttendances(supabase, page.map((s) => s.id));
      setAttendances((prev) => ({ ...prev, ...newAttendances }));
    }
    setLoadingMore(false);
  }

  const groups = groupByMonth(schedules, (s) => s.date);

  return (
    <PageShell header={<AppHeader title="過去の予定" variant="detail" backHref="/schedule" />}>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : schedules.length === 0 ? (
        <EmptyState>過去の予定はありません</EmptyState>
      ) : (
        <>
          {groups.map((g) => (
            <div key={g.key}>
              <SectionLabel>{g.label}</SectionLabel>
              {g.items.map((s) => (
                <ScheduleCard key={s.id} schedule={s} attendance={attendances[s.id]} />
              ))}
            </div>
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="block w-full mt-1 mb-2.5 text-center py-2 rounded-lg font-bold text-[12px] border border-line text-ink-soft bg-paper"
            >
              {loadingMore ? "読み込み中…" : "さらに読み込む"}
            </button>
          )}
        </>
      )}
    </PageShell>
  );
}
