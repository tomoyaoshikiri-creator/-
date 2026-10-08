"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { inputClass } from "@/components/ui/SegButton";
import type { LibraryFolder } from "@/lib/database.types";

// 1つのフォルダに対する改名・移動・削除。呼び出し元(library/page.tsx)で
// スタッフ(指導者・管理者)のみに開くボタンを出している(RLS側も同じ制限)。
export function FolderActionsModal({
  open,
  folder,
  onClose,
  onRenamed,
  onRequestMove,
  onDeleted,
}: {
  open: boolean;
  folder: LibraryFolder | null;
  onClose: () => void;
  onRenamed: () => void;
  onRequestMove: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (open && folder) {
      setName(folder.name);
      setDeleteConfirm(false);
    }
  }, [open, folder]);

  if (!folder) return null;

  async function handleRename() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast("フォルダ名を入力してください");
      return;
    }
    if (trimmed === folder!.name) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("library_folders")
      .update({ name: trimmed, updated_at: new Date().toISOString() })
      .eq("id", folder!.id);
    setSaving(false);
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }
    toast("フォルダ名を更新しました");
    onRenamed();
  }

  async function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from("library_folders").delete().eq("id", folder!.id);
    setDeleting(false);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    toast("フォルダを削除しました。中身は1つ上の階層に移動しました");
    onDeleted();
  }

  return (
    <Modal open={open} onClose={onClose} title="フォルダを編集">
      <input className={inputClass()} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex gap-2 mt-2.5">
        <button
          type="button"
          onClick={handleRename}
          disabled={saving || name.trim() === folder.name}
          className="flex-1 text-[12px] font-bold text-orange border border-orange rounded-lg px-3 py-2 bg-orange/8 disabled:opacity-40"
        >
          {saving ? "保存中…" : "名前を保存"}
        </button>
        <button
          type="button"
          onClick={onRequestMove}
          className="flex-1 text-[12px] font-bold border border-line rounded-lg px-3 py-2 bg-white text-ink-soft"
        >
          移動
        </button>
      </div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="w-full mt-3 text-[12px] font-bold border rounded-lg px-3 py-2 bg-white disabled:opacity-40"
        style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
      >
        {deleting ? "削除中…" : deleteConfirm ? "もう一度タップで削除確定" : "このフォルダを削除する"}
      </button>
    </Modal>
  );
}
