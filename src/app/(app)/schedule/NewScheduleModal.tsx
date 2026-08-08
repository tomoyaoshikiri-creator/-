"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { SegButton, SubmitButton, FieldLabel, inputClass } from "@/components/ui/SegButton";
import type { Schedule, ScheduleType } from "@/lib/database.types";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

export function NewScheduleModal({
  open,
  onClose,
  onCreated,
  editSchedule,
  copySource,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  editSchedule?: Schedule;
  copySource?: Schedule;
}) {
  const supabase = createClient();
  const { userId, teamId } = useSession();
  const toast = useToast();
  const isEdit = Boolean(editSchedule);

  const [type, setType] = useState<ScheduleType>("practice");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startHour, setStartHour] = useState("");
  const [startMin, setStartMin] = useState("");
  const [endHour, setEndHour] = useState("");
  const [endMin, setEndMin] = useState("");
  const [place, setPlace] = useState("");
  const [toban, setToban] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setType("practice");
    setTitle("");
    setDate("");
    setStartHour("");
    setStartMin("");
    setEndHour("");
    setEndMin("");
    setPlace("");
    setToban("");
  }

  useEffect(() => {
    if (!open) return;
    const source = editSchedule ?? copySource;
    if (source) {
      setType(source.type);
      setTitle(source.title);
      setDate(editSchedule ? source.date : "");
      const [sh, sm] = (source.start_time ?? "").split(":");
      setStartHour(sh ?? "");
      setStartMin(sm ?? "");
      const [eh, em] = (source.end_time ?? "").split(":");
      setEndHour(eh ?? "");
      setEndMin(em ?? "");
      setPlace(source.place ?? "");
      setToban(source.toban ?? "");
    } else {
      reset();
    }
  }, [open, editSchedule, copySource]);

  async function handleSubmit() {
    if (!title.trim()) {
      toast("タイトルを入力してください");
      return;
    }
    if (!date) {
      toast("日付を選択してください");
      return;
    }
    setSaving(true);
    const payload = {
      type,
      title: title.trim(),
      date,
      start_time: startHour && startMin ? `${startHour}:${startMin}` : null,
      end_time: endHour && endMin ? `${endHour}:${endMin}` : null,
      place: place.trim() || null,
      toban: type === "practice" ? toban.trim() || null : null,
    };
    const { error } = editSchedule
      ? await supabase.from("schedules").update(payload).eq("id", editSchedule.id)
      : await supabase.from("schedules").insert({ ...payload, team_id: teamId, created_by: userId });
    setSaving(false);
    if (error) {
      toast(`${isEdit ? "更新" : "登録"}に失敗しました: ${error.message}`);
      return;
    }
    if (!isEdit) reset();
    onCreated();
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "予定を編集" : "予定を登録"}>
      <FieldLabel>種別</FieldLabel>
      <div className="flex gap-2">
        <SegButton active={type === "practice"} onClick={() => setType("practice")}>
          練習
        </SegButton>
        <SegButton active={type === "game"} onClick={() => setType("game")}>
          試合
        </SegButton>
        <SegButton active={type === "event"} onClick={() => setType("event")}>
          イベント
        </SegButton>
      </div>

      <div className="mt-3">
        <FieldLabel>タイトル</FieldLabel>
        <input
          className={inputClass()}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例:練習"
        />
      </div>

      <div className="mt-3">
        <FieldLabel>日付</FieldLabel>
        <input type="date" className={inputClass()} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="mt-3">
        <FieldLabel>時刻(開始)</FieldLabel>
        <div className="flex gap-1.5 items-center">
          <select className={inputClass()} value={startHour} onChange={(e) => setStartHour(e.target.value)}>
            <option value="">--</option>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h}時
              </option>
            ))}
          </select>
          <span>:</span>
          <select className={inputClass()} value={startMin} onChange={(e) => setStartMin(e.target.value)}>
            <option value="">--</option>
            {MINUTES.map((m) => (
              <option key={m} value={m}>
                {m}分
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <FieldLabel>時刻(終了)</FieldLabel>
        <div className="flex gap-1.5 items-center">
          <select className={inputClass()} value={endHour} onChange={(e) => setEndHour(e.target.value)}>
            <option value="">--</option>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h}時
              </option>
            ))}
          </select>
          <span>:</span>
          <select className={inputClass()} value={endMin} onChange={(e) => setEndMin(e.target.value)}>
            <option value="">--</option>
            {MINUTES.map((m) => (
              <option key={m} value={m}>
                {m}分
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <FieldLabel>場所</FieldLabel>
        <input
          className={inputClass()}
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder="例:体育館A面"
        />
      </div>

      {type === "practice" && (
        <div className="mt-3">
          <FieldLabel>当番</FieldLabel>
          <input
            className={inputClass()}
            value={toban}
            onChange={(e) => setToban(e.target.value)}
            placeholder="例:田中家・佐藤家"
          />
        </div>
      )}

      <SubmitButton onClick={handleSubmit} disabled={saving}>
        {saving ? "処理中…" : isEdit ? "この内容で更新する" : "この内容で登録する"}
      </SubmitButton>
    </Modal>
  );
}
