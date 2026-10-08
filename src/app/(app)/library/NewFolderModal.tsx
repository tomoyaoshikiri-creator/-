"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";

export function NewFolderModal({
  open,
  parentFolderId,
  onClose,
  onCreated,
}: {
  open: boolean;
  parentFolderId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { teamId } = useSession();
  const toast = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast("フォルダ名を入力してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("library_folders")
      .insert({ team_id: teamId, parent_folder_id: parentFolderId, name: trimmed });
    setSaving(false);
    if (error) {
      toast(`作成に失敗しました: ${error.message}`);
      return;
    }
    setName("");
    onCreated();
  }

  return (
    <Modal open={open} onClose={onClose} title="フォルダを作成">
      <FieldLabel>フォルダ名</FieldLabel>
      <input
        className={inputClass()}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="例:練習メニュー"
      />
      <SubmitButton onClick={handleSubmit} disabled={saving}>
        {saving ? "作成中…" : "作成する"}
      </SubmitButton>
    </Modal>
  );
}
