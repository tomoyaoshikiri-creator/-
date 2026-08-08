"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { CurrentUserBadge } from "@/components/CurrentUserBadge";
import { EmptyState, SectionLabel } from "@/components/ui/Card";
import { SegButton } from "@/components/ui/SegButton";
import { Fab } from "@/components/ui/Modal";
import { canWriteSchedule } from "@/lib/permissions";
import type { Attendance, Schedule } from "@/lib/database.types";
import { ScheduleCard } from "./ScheduleCard";
import { NewScheduleModal } from "./NewScheduleModal";
import { CalendarView } from "./CalendarView";

export default function SchedulePage() {
  const { userId, role } = useSession();
  const toast = useToast();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [attendances, setAttendances] = useState<Record<string, Attendance>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: sch }, { data: att }] = await Promise.all([
      supabase.from("schedules").select("*").order("date", { ascending: true }),
      supabase.from("attendances").select("*").eq("user_id", userId),
    ]);
    setSchedules(sch ?? []);
    const map: Record<string, Attendance> = {};
    (att ?? []).forEach((a) => {
      map[a.schedule_id] = a;
    });
    setAttendances(map);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageShell
      header={<AppHeader title="直近の予定" searchPlaceholder="検索" rightSlot={<CurrentUserBadge />} />}
    >
      <div className="flex gap-2 mb-3.5">
        <SegButton active={view === "list"} onClick={() => setView("list")}>
          一覧
        </SegButton>
        <SegButton active={view === "calendar"} onClick={() => setView("calendar")}>
          カレンダー
        </SegButton>
      </div>

      {view === "list" ? (
        <div>
          <SectionLabel>予定 &amp; 出欠</SectionLabel>
          {loading ? (
            <EmptyState>読み込み中…</EmptyState>
          ) : schedules.length === 0 ? (
            <EmptyState>予定がありません</EmptyState>
          ) : (
            schedules.map((s) => (
              <ScheduleCard key={s.id} schedule={s} attendance={attendances[s.id]} />
            ))
          )}
        </div>
      ) : (
        <CalendarView schedules={schedules} />
      )}

      {canWriteSchedule(role) && (
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
          />
        </>
      )}
    </PageShell>
  );
}
