"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { SubmitButton, inputClass } from "@/components/ui/SegButton";
import { useToast } from "@/components/ui/Toast";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";

// チーム分析フィードバック・選手分析フィードバックの両方から使う、
// お知らせの新規登録と同じ形の「本文だけ入力して登録する」モーダル。
// 実際のinsert処理はテーブルが異なるため呼び出し側から渡してもらう。
export function AddFeedbackModal({
  open,
  onClose,
  onCreated,
  insert,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  insert: (body: string) => Promise<{ error: string | null }>;
}) {
  const toast = useToast();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  useUnsavedChangesGuard(open && body.trim() !== "");

  async function handleSubmit() {
    if (!body.trim()) {
      toast("内容を入力してください");
      return;
    }
    setSaving(true);
    const { error } = await insert(body.trim());
    setSaving(false);
    if (error) {
      toast(`登録に失敗しました: ${error}`);
      return;
    }
    setBody("");
    onCreated();
  }

  return (
    <Modal open={open} onClose={onClose} title="フィードバックを登録">
      <textarea
        rows={4}
        className={inputClass()}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="例:分析してもらった内容を貼り付ける"
      />
      <SubmitButton onClick={handleSubmit} disabled={saving}>
        {saving ? "登録中…" : "登録する"}
      </SubmitButton>
    </Modal>
  );
}
