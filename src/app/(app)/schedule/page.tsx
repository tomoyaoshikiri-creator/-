"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { hasCachedValue, useCachedState } from "@/lib/pageCache";
import { CardFooterLink, EmptyState, SectionLabel } from "@/components/ui/Card";
import { SegButton } from "@/components/ui/SegButton";
import { Fab } from "@/components/ui/Modal";
import { canWriteSchedule } from "@/lib/permissions";
import { playerFullName, todayDateStr } from "@/lib/format";
import type { Attendance, Schedule, ScheduleType } from "@/lib/database.types";
import type { Birthday } from "./CalendarView";
import { ScheduleCard } from "./ScheduleCard";
import { NewScheduleModal } from "./NewScheduleModal";
import { CalendarView } from "./CalendarView";

const TYPE_FILTER_OPTIONS: { value: ScheduleType | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "practice", label: "練習" },
  { value: "game", label: "試合" },
  { value: "event", label: "イベント" },
  { value: "other", label: "その他" },
];

export default function SchedulePage() {
  const { userId, role } = useSession();
  const toast = useToast();
  const searchParams = useSearchParams();
  // 「予定をコピーして登録」した直後、常に当日の月に戻るのではなく登録した予定の
  // 月に戻れるようにするための初期表示日(src/app/(app)/schedule/[id]/page.tsx参照)。
  const focusDate = searchParams.get("focus") || undefined;
  const [view, setView] = useState<"list" | "calendar">("calendar");
  const [typeFilter, setTypeFilter] = useState<ScheduleType | "all">("all");
  const [schedules, setSchedules] = useCachedState<Schedule[]>(`schedule:${userId}:schedules`, []);
  const [attendances, setAttendances] = useCachedState<Record<string, Attendance>>(
    `schedule:${userId}:attendances`,
    {},
  );
  const [birthdays, setBirthdays] = useCachedState<Birthday[]>(`schedule:${userId}:birthdays`, []);
  const [loading, setLoading] = useState(() => !hasCachedValue(`schedule:${userId}:schedules`));
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: sch }, { data: att }, { data: roster }, { data: memberBirthdays }] = await Promise.all([
      supabase
        .from("schedules")
        .select("*")
        .order("date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: false }),
      supabase.from("attendances").select("*").eq("user_id", userId),
      supabase.rpc("list_roster_players"),
      // 選手以外(指導者等)が自己登録した誕生日もカレンダーの🎂表示に含める。
      supabase.rpc("list_team_member_birthdays"),
    ]);
    setSchedules(sch ?? []);
    const map: Record<string, Attendance> = {};
    (att ?? []).forEach((a) => {
      map[a.schedule_id] = a;
    });
    setAttendances(map);
    setBirthdays([
      ...(roster ?? [])
        .filter((p) => p.birthday)
        .map((p) => ({ name: playerFullName(p), birthday: p.birthday as string })),
      ...(memberBirthdays ?? [])
        .filter((m) => m.birthday)
        .map((m) => ({ name: m.name, birthday: m.birthday as string })),
    ]);
    setLoading(false);
  }, [userId, setSchedules, setAttendances, setBirthdays]);

  useEffect(() => {
    load();
  }, [load]);

  const today = todayDateStr();
  const upcoming = useMemo(() => schedules.filter((s) => s.date >= today), [schedules, today]);
  const hasPast = useMemo(() => schedules.some((s) => s.date < today), [schedules, today]);

  const filtered = useMemo(() => {
    const q = query.trim();
    return upcoming.filter(
      (s) =>
        (typeFilter === "all" || s.type === typeFilter) &&
        (!q || s.title.includes(q) || (s.place ?? "").includes(q)),
    );
  }, [upcoming, query, typeFilter]);

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
                toast.success("予定を登録しました");
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
          <div className="flex gap-2 mb-3.5 flex-wrap">
            {TYPE_FILTER_OPTIONS.map((opt) => (
              <SegButton key={opt.value} variant="small" active={typeFilter === opt.value} onClick={() => setTypeFilter(opt.value)}>
                {opt.label}
              </SegButton>
            ))}
          </div>
          <SectionLabel>予定 &amp; 出欠</SectionLabel>
          {loading ? (
            <EmptyState>読み込み中…</EmptyState>
          ) : filtered.length === 0 ? (
            <EmptyState>{query || typeFilter !== "all" ? "該当する予定がありません" : "予定がありません"}</EmptyState>
          ) : (
            filtered.map((s) => <ScheduleCard key={s.id} schedule={s} attendance={attendances[s.id]} />)
          )}
          {!loading && !query && typeFilter === "all" && hasPast && (
            <CardFooterLink href="/schedule/history">過去の予定を見る</CardFooterLink>
          )}
        </div>
      ) : (
        <CalendarView
          schedules={schedules}
          attendances={attendances}
          birthdays={birthdays}
          initialFocusDate={focusDate}
          onSelectDate={setCalendarSelectedDate}
        />
      )}
    </PageShell>
  );
}
