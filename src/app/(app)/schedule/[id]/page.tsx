"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { TypeTag } from "@/components/ui/Pill";
import { scheduleMeta, playerFullName } from "@/lib/format";
import { canWriteSchedule } from "@/lib/permissions";
import type { Player, Schedule } from "@/lib/database.types";
import { AttendanceEntryForm } from "../AttendanceEntryForm";
import { AttendanceRosterModal } from "../AttendanceRosterModal";
import { NewScheduleModal } from "../NewScheduleModal";

interface AttendanceSubject {
  key: string;
  playerId: string | null;
  label: string;
}

export default function ScheduleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, role } = useSession();
  const toast = useToast();

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [subjects, setSubjects] = useState<AttendanceSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: s }, { data: links }] = await Promise.all([
      supabase.from("schedules").select("*").eq("id", params.id).single(),
      supabase.from("player_guardians").select("player_id").eq("profile_id", userId),
    ]);
    setSchedule(s ?? null);

    const playerIds = (links ?? []).map((l) => l.player_id);
    let linkedPlayers: Player[] = [];
    if (playerIds.length > 0) {
      const { data: p } = await supabase.from("players").select("*").in("id", playerIds);
      linkedPlayers = p ?? [];
    }

    const list: AttendanceSubject[] = [];
    if (role === "指導者" || role === "管理者") {
      list.push({ key: "self", playerId: null, label: "本人" });
    }
    for (const p of linkedPlayers) {
      list.push({ key: p.id, playerId: p.id, label: playerFullName(p) });
    }
    if (list.length === 0) {
      list.push({ key: "self", playerId: null, label: "自分" });
    }
    setSubjects(list);
    setLoading(false);
  }, [params.id, userId, role]);

  useEffect(() => {
    load();
  }, [load]);

  const isGame = schedule?.type === "game";

  return (
    <PageShell header={<AppHeader title={schedule?.title ?? "予定"} variant="detail" backHref="/schedule" />}>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : !schedule ? (
        <EmptyState>予定が見つかりません</EmptyState>
      ) : (
        <>
          <SectionLabel>予定の内容</SectionLabel>
          <Card>
            <div className="font-bold text-[14.5px]">
              <TypeTag type={schedule.type} />
              {schedule.title}
            </div>
            <div className="text-xs text-ink-soft mt-1">{scheduleMeta(schedule)}</div>
            {schedule.toban && <div className="text-xs text-ink-soft mt-1">当番:{schedule.toban}</div>}
          </Card>

          {canWriteSchedule(role) && (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setRosterOpen(true)}
                  className="px-3 py-1.5 rounded-[8px] border border-orange text-[11px] font-bold text-orange bg-orange/8"
                >
                  出欠一覧を見る
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="px-3 py-1.5 rounded-[8px] border border-line text-[11px] font-bold text-ink-soft bg-paper"
                >
                  編集
                </button>
                <button
                  type="button"
                  onClick={() => setCopyOpen(true)}
                  className="px-3 py-1.5 rounded-[8px] border border-line text-[11px] font-bold text-ink-soft bg-paper"
                >
                  コピーして登録
                </button>
              </div>
              <AttendanceRosterModal schedule={schedule} open={rosterOpen} onClose={() => setRosterOpen(false)} />
              <NewScheduleModal
                open={editOpen}
                onClose={() => setEditOpen(false)}
                editSchedule={schedule}
                onCreated={() => {
                  setEditOpen(false);
                  load();
                }}
              />
              <NewScheduleModal
                open={copyOpen}
                onClose={() => setCopyOpen(false)}
                copySource={schedule}
                onCreated={() => {
                  setCopyOpen(false);
                  toast("予定をコピーして登録しました");
                  router.push("/schedule");
                }}
              />
            </>
          )}

          {subjects.map((subject) => (
            <AttendanceEntryForm
              key={subject.key}
              scheduleId={schedule.id}
              userId={userId}
              playerId={subject.playerId}
              label={subject.label}
              isGame={isGame}
            />
          ))}
        </>
      )}
    </PageShell>
  );
}
