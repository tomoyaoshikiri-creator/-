"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { EmptyState, SectionLabel } from "@/components/ui/Card";
import { SegButton } from "@/components/ui/SegButton";
import { ChevronRightIcon } from "@/components/icons";
import { Fab } from "@/components/ui/Modal";
import { canWriteSchedule, isStaffRole } from "@/lib/permissions";
import { playerFullName, todayDateStr } from "@/lib/format";
import { computeUnseenScheduleIds } from "@/lib/itemBadges";
import type { Attendance, Schedule } from "@/lib/database.types";
import type { Birthday } from "./CalendarView";
import { ScheduleCard } from "./ScheduleCard";
import { NewScheduleModal } from "./NewScheduleModal";
import { CalendarView } from "./CalendarView";

export default function SchedulePage() {
  const { userId, role } = useSession();
  const toast = useToast();
  const [view, setView] = useState<"list" | "calendar">("calendar");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [attendances, setAttendances] = useState<Record<string, Attendance>>({});
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null);
  const [unseenScheduleIds, setUnseenScheduleIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: sch }, { data: att }, { data: roster }] = await Promise.all([
      supabase.from("schedules").select("*").order("date", { ascending: true }),
      supabase.from("attendances").select("*").eq("user_id", userId),
      supabase.rpc("list_roster_players"),
    ]);
    setSchedules(sch ?? []);
    const map: Record<string, Attendance> = {};
    (att ?? []).forEach((a) => {
      map[a.schedule_id] = a;
    });
    setAttendances(map);
    setBirthdays(
      (roster ?? [])
        .filter((p) => p.birthday)
        .map((p) => ({ name: playerFullName(p), birthday: p.birthday as string })),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // 一覧の中で「どの予定が新着か」を行ごとに示すため、タブを開いただけでは既読にしない
  // (個別の予定を開いたときにmarkItemSeenする。詳細はschedule/[id]/page.tsx)。
  useEffect(() => {
    if (!isStaffRole(role)) return;
    computeUnseenScheduleIds(userId).then(setUnseenScheduleIds);
  }, [userId, role, schedules]);

  const today = todayDateStr();
  const upcoming = useMemo(() => schedules.filter((s) => s.date >= today), [schedules, today]);
  const hasPast = useMemo(() => schedules.some((s) => s.date < today), [schedules, today]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return upcoming;
    return upcoming.filter((s) => s.title.includes(q) || (s.place ?? "").includes(q));
  }, [upcoming, query]);

  return (
    <PageShell
      header={
        <AppHeader
          title="スケジュール"
          searchPlaceholder="検索"
          searchValue={query}
          onSearchChange={setQuery}
        />
      }
      fab={
        canWriteSchedule(role) && (
          <>
            <Fab onClick={() => setModalOpen(true)} />
            <NewScheduleModal
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              onCreated={() => {
                setModalOpen(false);
                load();
                toast("予定を登録しました");
              }}
              initialDates={
                view === "calendar" && calendarSelectedDate ? [calendarSelectedDate] : undefined
              }
            />
          </>
        )
      }
    >
      <div className="flex gap-2 mb-3.5">
        <SegButton variant="small" active={view === "calendar"} onClick={() => setView("calendar")}>
          カレンダー表示
        </SegButton>
        <SegButton variant="small" active={view === "list"} onClick={() => setView("list")}>
          予定一覧表示
        </SegButton>
      </div>

      {view === "list" ? (
        <div>
          <SectionLabel>予定 &amp; 出欠</SectionLabel>
          {loading ? (
            <EmptyState>読み込み中…</EmptyState>
          ) : filtered.length === 0 ? (
            <EmptyState>{query ? "該当する予定がありません" : "予定がありません"}</EmptyState>
          ) : (
            filtered.map((s) => (
              <ScheduleCard key={s.id} schedule={s} attendance={attendances[s.id]} hasUpdate={unseenScheduleIds.has(s.id)} />
            ))
          )}
          {!loading && !query && hasPast && (
            <Link
              href="/schedule/history"
              className="flex items-center justify-center gap-1 mt-2 py-2.5 text-[12.5px] font-bold text-ink-soft"
            >
              過去の予定を見る
              <ChevronRightIcon className="w-3 h-3" />
            </Link>
          )}
        </div>
      ) : (
        <CalendarView schedules={schedules} birthdays={birthdays} onSelectDate={setCalendarSelectedDate} />
      )}
    </PageShell>
  );
}
