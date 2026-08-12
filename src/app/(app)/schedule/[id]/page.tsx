"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { TypeTag } from "@/components/ui/Pill";
import { FieldLabel, inputClass } from "@/components/ui/SegButton";
import { isTargetEligible, playerFullName, scheduleMeta, sortPlayers } from "@/lib/format";
import { canWriteSchedule } from "@/lib/permissions";
import type { Player, Schedule } from "@/lib/database.types";
import { AttendanceEntryForm } from "../AttendanceEntryForm";
import { AttendanceRosterModal } from "../AttendanceRosterModal";
import { NewScheduleModal } from "../NewScheduleModal";
import { PracticeMenuCard } from "../PracticeMenuCard";

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
  const [excludedLinkedCount, setExcludedLinkedCount] = useState(0);
  const [proxyPlayers, setProxyPlayers] = useState<Player[]>([]);
  const [proxyPlayerId, setProxyPlayerId] = useState("");
  const [unlinkedGuardians, setUnlinkedGuardians] = useState<{ id: string; name: string }[]>([]);
  const [unlinkedGuardianId, setUnlinkedGuardianId] = useState("");
  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
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

    if (s) {
      const [{ data: prevRows }, { data: nextRows }] = await Promise.all([
        supabase
          .from("schedules")
          .select("id")
          .or(`date.lt.${s.date},and(date.eq.${s.date},created_at.lt.${s.created_at})`)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("schedules")
          .select("id")
          .or(`date.gt.${s.date},and(date.eq.${s.date},created_at.gt.${s.created_at})`)
          .order("date", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(1),
      ]);
      setPrevId(prevRows?.[0]?.id ?? null);
      setNextId(nextRows?.[0]?.id ?? null);
    } else {
      setPrevId(null);
      setNextId(null);
    }

    const playerIds = (links ?? []).map((l) => l.player_id);
    let linkedPlayers: Player[] = [];
    if (playerIds.length > 0) {
      const { data: p } = await supabase.from("players").select("*").in("id", playerIds);
      linkedPlayers = p ?? [];
    }

    const targetGradeMin = s?.target_grade_min ?? null;
    const eligibleLinked = linkedPlayers.filter((p) => isTargetEligible(p.grade, targetGradeMin));

    const list: AttendanceSubject[] = [];
    if (role === "指導者" || role === "管理者") {
      list.push({ key: "self", playerId: null, label: "本人" });
    }
    for (const p of eligibleLinked) {
      list.push({ key: p.id, playerId: p.id, label: playerFullName(p) });
    }
    if (list.length === 0) {
      list.push({ key: "self", playerId: null, label: "自分" });
    }
    setSubjects(list);
    setExcludedLinkedCount(linkedPlayers.length - eligibleLinked.length);

    if (role === "管理者") {
      const { data: allPlayers } = await supabase.from("players").select("*").eq("status", "在籍");
      const coveredIds = new Set(eligibleLinked.map((p) => p.id));
      setProxyPlayers(
        sortPlayers(
          (allPlayers ?? [])
            .filter((p) => isTargetEligible(p.grade, targetGradeMin))
            .filter((p) => !coveredIds.has(p.id)),
        ),
      );

      const [{ data: guardianProfiles }, { data: allLinks }] = await Promise.all([
        supabase.from("profiles").select("id, name, role").in("role", ["一般", "役員"]).order("name"),
        supabase.from("player_guardians").select("profile_id"),
      ]);
      const linkedIds = new Set((allLinks ?? []).map((l) => l.profile_id));
      setUnlinkedGuardians((guardianProfiles ?? []).filter((p) => !linkedIds.has(p.id)));
    } else {
      setProxyPlayers([]);
      setUnlinkedGuardians([]);
    }
    setProxyPlayerId("");
    setUnlinkedGuardianId("");
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
          <div className="flex items-center justify-between mb-3">
            {prevId ? (
              <Link
                href={`/schedule/${prevId}`}
                aria-label="前の予定"
                className="w-[30px] h-[30px] rounded-lg bg-white border border-line flex items-center justify-center text-base text-navy"
              >
                ‹
              </Link>
            ) : (
              <span className="w-[30px] h-[30px] rounded-lg bg-white border border-line flex items-center justify-center text-base text-line">
                ‹
              </span>
            )}
            {nextId ? (
              <Link
                href={`/schedule/${nextId}`}
                aria-label="次の予定"
                className="w-[30px] h-[30px] rounded-lg bg-white border border-line flex items-center justify-center text-base text-navy"
              >
                ›
              </Link>
            ) : (
              <span className="w-[30px] h-[30px] rounded-lg bg-white border border-line flex items-center justify-center text-base text-line">
                ›
              </span>
            )}
          </div>

          <SectionLabel>予定の内容</SectionLabel>
          <Card className="!py-[11px]">
            <div className="font-bold text-[16.5px]">
              <TypeTag type={schedule.type} gameCategory={schedule.game_category} />
              {schedule.title}
            </div>
            <div className="text-[14.5px] text-ink mt-1.5">{scheduleMeta(schedule)}</div>
            {schedule.toban && <div className="text-[14.5px] text-ink mt-1.5">当番:{schedule.toban}</div>}
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
              <AttendanceRosterModal
                schedule={schedule}
                open={rosterOpen}
                onClose={() => setRosterOpen(false)}
                userId={userId}
                role={role}
              />
              <NewScheduleModal
                open={editOpen}
                onClose={() => setEditOpen(false)}
                editSchedule={schedule}
                onCreated={() => {
                  setEditOpen(false);
                  load();
                }}
                onDeleted={() => {
                  setEditOpen(false);
                  toast("予定を削除しました");
                  router.push("/schedule");
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

          {excludedLinkedCount > 0 && (
            <div className="text-xs text-ink-soft text-center mt-1 mb-2">
              ※この予定の対象学年外のため、出欠登録の対象外のお子さまがいます
            </div>
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

          {schedule.type === "practice" && <PracticeMenuCard scheduleId={schedule.id} />}

          {role === "管理者" && proxyPlayers.length > 0 && (
            <>
              <SectionLabel>選手の出欠を代理登録(管理者)</SectionLabel>
              <Card>
                <FieldLabel>選手を選ぶ</FieldLabel>
                <select
                  className={inputClass()}
                  value={proxyPlayerId}
                  onChange={(e) => setProxyPlayerId(e.target.value)}
                >
                  <option value="">選手を選択してください</option>
                  {proxyPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {playerFullName(p)}
                    </option>
                  ))}
                </select>
              </Card>
              {proxyPlayerId && (
                <AttendanceEntryForm
                  key={proxyPlayerId}
                  scheduleId={schedule.id}
                  userId={userId}
                  playerId={proxyPlayerId}
                  label={playerFullName(proxyPlayers.find((p) => p.id === proxyPlayerId)!)}
                  isGame={isGame}
                />
              )}
            </>
          )}

          {role === "管理者" && unlinkedGuardians.length > 0 && (
            <>
              <SectionLabel>未紐付けの保護者の出欠を修正・削除(管理者)</SectionLabel>
              <Card>
                <FieldLabel>保護者を選ぶ</FieldLabel>
                <select
                  className={inputClass()}
                  value={unlinkedGuardianId}
                  onChange={(e) => setUnlinkedGuardianId(e.target.value)}
                >
                  <option value="">保護者を選択してください</option>
                  {unlinkedGuardians.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Card>
              {unlinkedGuardianId && (
                <AttendanceEntryForm
                  key={unlinkedGuardianId}
                  scheduleId={schedule.id}
                  userId={unlinkedGuardianId}
                  playerId={null}
                  label={unlinkedGuardians.find((p) => p.id === unlinkedGuardianId)!.name}
                  isGame={isGame}
                  allowDelete
                />
              )}
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
