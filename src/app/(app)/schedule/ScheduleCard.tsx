"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { TypeTag } from "@/components/ui/Pill";
import { SegButton, SubmitButton, FieldLabel, inputClass } from "@/components/ui/SegButton";
import { scheduleMeta } from "@/lib/format";
import type { Attendance, AttendanceStatus, CarStatus, Schedule, YesNo } from "@/lib/database.types";

export function ScheduleCard({
  schedule,
  attendance,
  onSaved,
}: {
  schedule: Schedule;
  attendance?: Attendance;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const { userId } = useSession();
  const toast = useToast();

  const [status, setStatus] = useState<AttendanceStatus | null>(attendance?.status ?? null);
  const [accompany, setAccompany] = useState<YesNo | null>(attendance?.accompany ?? null);
  const [accompanyCount, setAccompanyCount] = useState(attendance?.accompany_count?.toString() ?? "");
  const [car, setCar] = useState<CarStatus | null>(attendance?.car ?? null);
  const [seats, setSeats] = useState(attendance?.seats?.toString() ?? "");
  const [note, setNote] = useState(attendance?.note ?? "");
  const [saving, setSaving] = useState(false);

  const isGame = schedule.type === "game";
  const pillTone = status === "出席" ? "ok" : "pending";
  const pillLabel = status ?? "未回答";

  async function handleSubmit() {
    if (!status) {
      toast("選手の出欠を選択してください");
      return;
    }
    setSaving(true);
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
    onSaved();
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold text-[14.5px]">
            <TypeTag type={schedule.type} />
            {schedule.title}
          </div>
          <div className="text-xs text-ink-soft mt-0.5">{scheduleMeta(schedule)}</div>
          {schedule.toban && (
            <div className="text-xs text-ink-soft mt-0.5">当番:{schedule.toban}</div>
          )}
        </div>
        <Pill tone={pillTone}>{pillLabel}</Pill>
      </div>

      <div className="mt-3">
        <FieldLabel>選手の出欠</FieldLabel>
        <div className="flex gap-2">
          <SegButton active={status === "出席"} onClick={() => setStatus("出席")}>
            出席
          </SegButton>
          <SegButton active={status === "欠席"} onClick={() => setStatus("欠席")}>
            欠席
          </SegButton>
        </div>
      </div>

      {isGame && (
        <>
          <div className="mt-3">
            <FieldLabel>保護者の帯同</FieldLabel>
            <div className="flex gap-2">
              <SegButton variant="small" active={accompany === "あり"} onClick={() => setAccompany("あり")}>
                あり
              </SegButton>
              <SegButton variant="small" active={accompany === "なし"} onClick={() => setAccompany("なし")}>
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
                onChange={(e) => setAccompanyCount(e.target.value)}
                placeholder="例:2"
              />
            </div>
          )}

          <div className="mt-3">
            <FieldLabel>車出し</FieldLabel>
            <div className="flex gap-2">
              <SegButton variant="small" active={car === "可"} onClick={() => setCar("可")}>
                可
              </SegButton>
              <SegButton variant="small" active={car === "不可"} onClick={() => setCar("不可")}>
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
                onChange={(e) => setSeats(e.target.value)}
                placeholder="例:3"
              />
              <div className="mt-2">
                <FieldLabel>備考</FieldLabel>
                <textarea
                  rows={2}
                  className={inputClass()}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="集合場所や注意点など"
                />
              </div>
            </div>
          )}
        </>
      )}

      <SubmitButton onClick={handleSubmit} disabled={saving}>
        {saving ? "登録中…" : "この内容で登録する"}
      </SubmitButton>
    </Card>
  );
}
