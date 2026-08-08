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
import { SegButton, SubmitButton, FieldLabel, inputClass } from "@/components/ui/SegButton";
import { scheduleMeta } from "@/lib/format";
import { canWriteSchedule } from "@/lib/permissions";
import type { AttendanceStatus, CarStatus, Schedule, YesNo } from "@/lib/database.types";
import { AttendanceRosterModal } from "../AttendanceRosterModal";
import { NewScheduleModal } from "../NewScheduleModal";

export default function ScheduleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, role } = useSession();
  const toast = useToast();

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [accompany, setAccompany] = useState<YesNo | null>(null);
  const [accompanyCount, setAccompanyCount] = useState("");
  const [car, setCar] = useState<CarStatus | null>(null);
  const [seats, setSeats] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [registered, setRegistered] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: s }, { data: a }] = await Promise.all([
      supabase.from("schedules").select("*").eq("id", params.id).single(),
      supabase.from("attendances").select("*").eq("schedule_id", params.id).eq("user_id", userId).maybeSingle(),
    ]);
    setSchedule(s ?? null);
    setStatus(a?.status ?? null);
    setAccompany(a?.accompany ?? null);
    setAccompanyCount(a?.accompany_count?.toString() ?? "");
    setCar(a?.car ?? null);
    setSeats(a?.seats?.toString() ?? "");
    setNote(a?.note ?? "");
    setRegistered(Boolean(a?.status));
    setLoading(false);
  }, [params.id, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const isGame = schedule?.type === "game";

  async function handleSubmit() {
    if (!schedule) return;
    if (!status) {
      toast("選手の出欠を選択してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("attendances").upsert(
      {
        schedule_id: schedule.id,
        user_id: userId,
        status,
        accompany: isGame ? accompany : null,
        accompany_count: isGame && accompany === "あり" && accompanyCount ? Number(accompanyCount) : null,
        car: isGame ? car : null,
        seats: isGame && car === "可" && seats ? Number(seats) : null,
        note: isGame ? note || null : null,
      },
      { onConflict: "schedule_id,user_id" },
    );
    setSaving(false);
    if (error) {
      toast(`保存に失敗しました: ${error.message}`);
      return;
    }
    toast("登録しました");
    setRegistered(true);
  }

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

          <SectionLabel>選手の出欠</SectionLabel>
          <Card>
            <div className="flex gap-2">
              <SegButton
                active={status === "出席"}
                onClick={() => {
                  setStatus("出席");
                  setRegistered(false);
                }}
              >
                出席
              </SegButton>
              <SegButton
                active={status === "欠席"}
                onClick={() => {
                  setStatus("欠席");
                  setRegistered(false);
                }}
              >
                欠席
              </SegButton>
            </div>

            {isGame && (
              <>
                <div className="mt-3">
                  <FieldLabel>保護者の帯同</FieldLabel>
                  <div className="flex gap-2">
                    <SegButton
                      variant="small"
                      active={accompany === "あり"}
                      onClick={() => {
                        setAccompany("あり");
                        setRegistered(false);
                      }}
                    >
                      あり
                    </SegButton>
                    <SegButton
                      variant="small"
                      active={accompany === "なし"}
                      onClick={() => {
                        setAccompany("なし");
                        setRegistered(false);
                      }}
                    >
                      なし
                    </SegButton>
                  </div>
                </div>
                {accompany === "あり" && (
                  <div className="mt-3">
                    <FieldLabel>帯同人数</FieldLabel>
                    <input
                      type="number"
                      min={1}
                      className={inputClass()}
                      value={accompanyCount}
                      onChange={(e) => {
                        setAccompanyCount(e.target.value);
                        setRegistered(false);
                      }}
                      placeholder="例:2"
                    />
                  </div>
                )}

                <div className="mt-3">
                  <FieldLabel>車出し</FieldLabel>
                  <div className="flex gap-2">
                    <SegButton
                      variant="small"
                      active={car === "可"}
                      onClick={() => {
                        setCar("可");
                        setRegistered(false);
                      }}
                    >
                      可
                    </SegButton>
                    <SegButton
                      variant="small"
                      active={car === "不可"}
                      onClick={() => {
                        setCar("不可");
                        setRegistered(false);
                      }}
                    >
                      不可
                    </SegButton>
                  </div>
                </div>
                {car === "可" && (
                  <div className="mt-3">
                    <FieldLabel>乗車可能人数</FieldLabel>
                    <input
                      type="number"
                      min={0}
                      className={inputClass()}
                      value={seats}
                      onChange={(e) => {
                        setSeats(e.target.value);
                        setRegistered(false);
                      }}
                      placeholder="例:3"
                    />
                    <div className="mt-2">
                      <FieldLabel>備考</FieldLabel>
                      <textarea
                        rows={2}
                        className={inputClass()}
                        value={note}
                        onChange={(e) => {
                          setNote(e.target.value);
                          setRegistered(false);
                        }}
                        placeholder="集合場所や注意点など"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <SubmitButton onClick={handleSubmit} disabled={saving} className={registered ? "opacity-45" : ""}>
              {saving ? "登録中…" : registered ? "登録済み(この内容で更新する)" : "この内容で登録する"}
            </SubmitButton>
          </Card>
        </>
      )}
    </PageShell>
  );
}
