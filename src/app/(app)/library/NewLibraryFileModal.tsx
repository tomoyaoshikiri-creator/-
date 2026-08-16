"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { FieldLabel, SubmitButton } from "@/components/ui/SegButton";
import { safeExt } from "@/lib/storagePath";

export function NewLibraryFileModal({
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

  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  function reset() {
    setFiles([]);
  }

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    setFiles((prev) => [...prev, ...Array.from(newFiles)]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (files.length === 0) {
      toast("ファイルを選んでください");
      return;
    }
    setSaving(true);
    for (const file of files) {
      const path = `${teamId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("library-files").upload(path, file);
      if (uploadError) {
        toast(`${file.name}のアップロードに失敗しました: ${uploadError.message}`);
        continue;
      }
      const { error: insertError } = await supabase.from("library_files").insert({
        team_id: teamId,
        uploader_id: userId,
        storage_path: path,
        file_name: file.name,
      });
      if (insertError) {
        toast(`${file.name}の登録に失敗しました: ${insertError.message}`);
      }
    }
    setSaving(false);
    reset();
    onCreated();
  }

  return (
    <Modal open={open} onClose={onClose} title="ファイルを追加">
      <FieldLabel>画像・資料</FieldLabel>
      <label className="inline-flex items-center gap-1 px-3 py-2 rounded-[10px] text-[12.5px] font-bold border border-line bg-paper text-ink-soft cursor-pointer">
        📎 ファイルを選ぶ
        <input
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {files.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-xs text-ink-soft">
              <span className="truncate">{f.name}</span>
              <button type="button" onClick={() => removeFile(i)} className="flex-none font-bold" style={{ color: "var(--danger)" }}>
                削除
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="text-xs text-ink-soft mt-1.5">※タップすると端末の「カメラロール」「ファイル」などから選べます</div>
      <SubmitButton onClick={handleSubmit} disabled={saving}>
        {saving ? "アップロード中…" : "追加する"}
      </SubmitButton>
    </Modal>
  );
}
