"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { DateSelect, DATE_OPTIONS } from "./DateSelect";

export function NewCoachNoteModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const supabase = createClient();
  const { userId, teamId } = useSession();
  const toast = useToast();
  const todayValue = DATE_OPTIONS[DATE_OPTIONS.length - 1].value;

  const [dateValue, setDateValue] = useState(todayValue);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  useUnsavedChangesGuard(open && body.trim() !== "");

  function reset() {
    setDateValue(todayValue);
    setBody("");
  }

  async function handleSubmit() {
    if (!body.trim()) {
      toast("内容を入力してください");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("reports").insert({
      team_id: teamId,
      author_id: userId,
      date: dateValue,
      body: body.trim(),
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
    <Modal open={open} onClose={onClose} title="コーチノートを書く">
      <FieldLabel>日付</FieldLabel>
      <DateSelect value={dateValue} onChange={setDateValue} />
      <div className="mt-3">
        <FieldLabel>内容</FieldLabel>
        <textarea
          rows={3}
          className={inputClass()}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="今日の練習で気づいたこと・思ったこと"
        />
      </div>
      <SubmitButton onClick={handleSubmit} disabled={saving}>
        {saving ? "登録中…" : "登録する"}
      </SubmitButton>
    </Modal>
  );
}
