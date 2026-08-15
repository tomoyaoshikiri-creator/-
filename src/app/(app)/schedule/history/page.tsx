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

export default function ScheduleHistoryPage() {
  const { userId } = useSession();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [attendances, setAttendances] = useState<Record<string, Attendance>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: sch }, { data: att }] = await Promise.all([
      supabase.from("schedules").select("*").lt("date", todayDateStr()).order("date", { ascending: false }),
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

  const groups = groupByMonth(schedules, (s) => s.date);

  return (
    <PageShell header={<AppHeader title="過去の予定" variant="detail" backHref="/schedule" />}>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : schedules.length === 0 ? (
        <EmptyState>過去の予定はありません</EmptyState>
      ) : (
        groups.map((g) => (
          <div key={g.key}>
            <SectionLabel>{g.label}</SectionLabel>
            {g.items.map((s) => (
              <ScheduleCard key={s.id} schedule={s} attendance={attendances[s.id]} />
            ))}
          </div>
        ))
      )}
    </PageShell>
  );
}
