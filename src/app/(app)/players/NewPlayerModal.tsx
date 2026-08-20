"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { SegButton, SubmitButton, FieldLabel, inputClass } from "@/components/ui/SegButton";
import { GRADES_BY_CATEGORY, POSITIONS_BY_SPORT } from "@/lib/playerOptions";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { BirthdaySelect } from "./BirthdaySelect";
import type { Grade, Position } from "@/lib/database.types";

export function NewPlayerModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const supabase = createClient();
  const { teamId, sport, category } = useSession();
  const toast = useToast();
  const positionOptions = POSITIONS_BY_SPORT[sport];
  const gradeOptions = GRADES_BY_CATEGORY[category];

  const [sei, setSei] = useState("");
  const [mei, setMei] = useState("");
  const [seiKana, setSeiKana] = useState("");
  const [meiKana, setMeiKana] = useState("");
  const [grade, setGrade] = useState<Grade | "">("");
  const [number, setNumber] = useState("");
  const [positions, setPositions] = useState<Position[]>([]);
  const [birthday, setBirthday] = useState("");
  const [saving, setSaving] = useState(false);

  useUnsavedChangesGuard(
    open &&
      (sei.trim() !== "" ||
        mei.trim() !== "" ||
        seiKana.trim() !== "" ||
        meiKana.trim() !== "" ||
        grade !== "" ||
        number.trim() !== "" ||
        positions.length > 0 ||
        birthday !== ""),
  );

  function reset() {
    setSei("");
    setMei("");
    setSeiKana("");
    setMeiKana("");
    setGrade("");
    setNumber("");
    setPositions([]);
    setBirthday("");
  }

  function togglePos(p: Position) {
    setPositions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function handleSubmit() {
    if (!sei.trim() || !mei.trim()) {
      toast("氏名を入力してください");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("players").insert({
      team_id: teamId,
      sei: sei.trim(),
      mei: mei.trim(),
      sei_kana: seiKana.trim() || null,
      mei_kana: meiKana.trim() || null,
      grade: grade || null,
      number: number.trim() || null,
      positions,
      birthday: birthday || null,
    });
    setSaving(false);
    if (error) {
      toast(`登録に失敗しました: ${error.message}`);
      return;
    }
    reset();
    onCreated();
  }

  return (
    <Modal open={open} onClose={onClose} title="選手を登録">
      <div className="flex gap-2">
        <div className="flex-1">
          <FieldLabel>氏</FieldLabel>
          <input className={inputClass()} value={sei} onChange={(e) => setSei(e.target.value)} placeholder="例:田中" />
        </div>
        <div className="flex-1">
          <FieldLabel>名</FieldLabel>
          <input className={inputClass()} value={mei} onChange={(e) => setMei(e.target.value)} placeholder="例:陽翔" />
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <div className="flex-1">
          <FieldLabel>氏(カナ)</FieldLabel>
          <input
            className={inputClass()}
            value={seiKana}
            onChange={(e) => setSeiKana(e.target.value)}
            placeholder="タナカ"
          />
        </div>
        <div className="flex-1">
          <FieldLabel>名(カナ)</FieldLabel>
          <input
            className={inputClass()}
            value={meiKana}
            onChange={(e) => setMeiKana(e.target.value)}
            placeholder="ハルト"
          />
        </div>
      </div>

      {gradeOptions.length > 0 ? (
        <div className="mt-3">
          <FieldLabel>学年</FieldLabel>
          <select className={inputClass()} value={grade} onChange={(e) => setGrade(e.target.value as Grade | "")}>
            <option value="">選択してください</option>
            {gradeOptions.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="mt-3 text-xs text-ink-soft bg-paper border border-dashed border-line rounded-[10px] px-3 py-2.5">
          このカテゴリーでは学年を登録しません。
        </div>
      )}

      <div className="mt-3">
        <FieldLabel>誕生日</FieldLabel>
        <BirthdaySelect value={birthday} onChange={setBirthday} />
      </div>

      <div className="mt-3">
        <FieldLabel>背番号(リバ)</FieldLabel>
        <input className={inputClass()} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="例:7" />
      </div>

      <div className="mt-3">
        <FieldLabel>ポジション(複数選択可)</FieldLabel>
        <div className="flex gap-1.5 flex-wrap">
          {positionOptions.map((p) => (
            <SegButton key={p} variant="small" active={positions.includes(p)} onClick={() => togglePos(p)} className="flex-none px-3.5">
              {p}
            </SegButton>
          ))}
        </div>
      </div>

      <SubmitButton onClick={handleSubmit} disabled={saving}>
        {saving ? "登録中…" : "この内容で登録する"}
      </SubmitButton>
    </Modal>
  );
}
