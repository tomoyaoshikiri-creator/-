"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { SegButton, SubmitButton, FieldLabel, inputClass } from "@/components/ui/SegButton";
import { formatDateLabel } from "@/lib/format";
import type { GameCategory, Schedule, ScheduleType } from "@/lib/database.types";
import { MiniCalendarPicker } from "./MiniCalendarPicker";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

export function NewScheduleModal({
  open,
  onClose,
  onCreated,
  onDeleted,
  editSchedule,
  copySource,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  onDeleted?: () => void;
  editSchedule?: Schedule;
  copySource?: Schedule;
}) {
  const supabase = createClient();
  const { userId, teamId } = useSession();
  const toast = useToast();
  const isEdit = Boolean(editSchedule);

  const [type, setType] = useState<ScheduleType>("practice");
  const [gameCategory, setGameCategory] = useState<GameCategory>("練習試合");
  const [title, setTitle] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [startHour, setStartHour] = useState("");
  const [startMin, setStartMin] = useState("");
  const [endHour, setEndHour] = useState("");
  const [endMin, setEndMin] = useState("");
  const [place, setPlace] = useState("");
  const [toban, setToban] = useState("");
  const [targetGradeMin, setTargetGradeMin] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  function reset() {
    setType("practice");
    setGameCategory("練習試合");
    setTitle("");
    setDates([]);
    setStartHour("");
    setStartMin("");
    setEndHour("");
    setEndMin("");
    setPlace("");
    setToban("");
    setTargetGradeMin("");
  }

  useEffect(() => {
    if (!open) return;
    setDeleteConfirm(false);
    const source = editSchedule ?? copySource;
    if (source) {
      setType(source.type);
      setGameCategory(source.game_category ?? "練習試合");
      setTitle(source.title);
      setDates(editSchedule ? [source.date] : []);
      const [sh, sm] = (source.start_time ?? "").split(":");
      setStartHour(sh ?? "");
      setStartMin(sm ?? "");
      const [eh, em] = (source.end_time ?? "").split(":");
      setEndHour(eh ?? "");
      setEndMin(em ?? "");
      setPlace(source.place ?? "");
      setToban(editSchedule ? (source.toban ?? "") : "");
      setTargetGradeMin(source.target_grade_min ?? "");
    } else {
      reset();
    }
  }, [open, editSchedule, copySource]);

  function toggleDate(d: string) {
    setDates((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  async function handleSubmit() {
    if (!title.trim()) {
      toast("タイトルを入力してください");
      return;
    }
    if (dates.length === 0) {
      toast("日付を選択してください");
      return;
    }
    setSaving(true);
    const base = {
      type,
      title: title.trim(),
      start_time: startHour && startMin ? `${startHour}:${startMin}` : null,
      end_time: endHour && endMin ? `${endHour}:${endMin}` : null,
      place: place.trim() || null,
      toban: type === "practice" ? toban.trim() || null : null,
      target_grade_min: targetGradeMin || null,
      game_category: type === "game" ? gameCategory : null,
    };
    const { error } = editSchedule
      ? await supabase
          .from("schedules")
          .update({ ...base, date: dates[0] })
          .eq("id", editSchedule.id)
      : await supabase
          .from("schedules")
          .insert(dates.map((date) => ({ ...base, date, team_id: teamId, created_by: userId })));
    setSaving(false);
    if (error) {
      toast(`${isEdit ? "更新" : "登録"}に失敗しました: ${error.message}`);
      return;
    }
    if (!isEdit) reset();
    onCreated();
  }

  async function handleDelete() {
    if (!editSchedule) return;
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    setDeleting(true);
    const { error } = await supabase.from("schedules").delete().eq("id", editSchedule.id);
    setDeleting(false);
    setDeleteConfirm(false);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    onDeleted?.();
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

      {type === "game" && (
        <div className="mt-3">
          <FieldLabel>試合の区分</FieldLabel>
          <div className="flex gap-2">
            <SegButton active={gameCategory === "練習試合"} onClick={() => setGameCategory("練習試合")}>
              練習試合
            </SegButton>
            <SegButton active={gameCategory === "公式戦"} onClick={() => setGameCategory("公式戦")}>
              公式戦
            </SegButton>
          </div>
        </div>
      )}

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
        <FieldLabel>{isEdit ? "日付" : "日付(複数選択可)"}</FieldLabel>
        {isEdit ? (
          <>
            <MiniCalendarPicker
              selected={dates}
              onToggle={(d) => setDates([d])}
              initialDate={editSchedule?.date}
            />
            {dates[0] && (
              <div className="text-xs text-ink-soft mt-1.5">選択中:{formatDateLabel(dates[0])}</div>
            )}
          </>
        ) : (
          <>
            <MiniCalendarPicker selected={dates} onToggle={toggleDate} />
            {dates.length > 0 && (
              <div className="mt-2 flex gap-1.5 flex-wrap">
                {dates.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDate(d)}
                    className="font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-navy/8 text-navy"
                  >
                    {formatDateLabel(d)} ×
                  </button>
                ))}
              </div>
            )}
          </>
        )}
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

      <div className="mt-3">
        <FieldLabel>対象</FieldLabel>
        <select className={inputClass()} value={targetGradeMin} onChange={(e) => setTargetGradeMin(e.target.value)}>
          <option value="">全員</option>
          {["1", "2", "3", "4", "5", "6"].map((g) => (
            <option key={g} value={g}>
              {g}年生以上
            </option>
          ))}
        </select>
        <div className="text-xs text-ink-soft mt-1">
          「○年生以上」を選ぶと、対象外の学年の選手は出欠登録の対象から外れます。
        </div>
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

      <SubmitButton onClick={handleSubmit} disabled={saving || deleting}>
        {saving
          ? "処理中…"
          : isEdit
            ? "この内容で更新する"
            : dates.length > 1
              ? `この内容で${dates.length}件登録する`
              : "この内容で登録する"}
      </SubmitButton>

      {isEdit && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={saving || deleting}
          className="w-full mt-2.5 text-center py-2 rounded-[10px] font-bold text-[12.5px] border bg-white disabled:opacity-50"
          style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
        >
          {deleting ? "削除中…" : deleteConfirm ? "もう一度タップで削除確定" : "この予定を削除する"}
        </button>
      )}
    </Modal>
  );
}
