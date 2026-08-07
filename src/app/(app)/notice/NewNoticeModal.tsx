"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { SubmitButton, FieldLabel, inputClass } from "@/components/ui/SegButton";
import { safeExt } from "@/lib/storagePath";
import type { AttachmentKind } from "@/lib/database.types";

const KINDS: { kind: AttachmentKind; emoji: string }[] = [
  { kind: "対戦表", emoji: "📋" },
  { kind: "配車表", emoji: "🚗" },
  { kind: "その他", emoji: "📎" },
];

export function NewNoticeModal({
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

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<Partial<Record<AttachmentKind, File>>>({});
  const [saving, setSaving] = useState(false);

  function reset() {
    setTitle("");
    setBody("");
    setFiles({});
  }

  function pickFile(kind: AttachmentKind, file: File | undefined) {
    setFiles((prev) => {
      const next = { ...prev };
      if (file) next[kind] = file;
      else delete next[kind];
      return next;
    });
  }

  async function handleSubmit() {
    if (!title.trim()) {
      toast("タイトルを入力してください");
      return;
    }
    setSaving(true);

    const { data: notice, error } = await supabase
      .from("notices")
      .insert({ team_id: teamId, title: title.trim(), body: body.trim() || null, sender_id: userId })
      .select()
      .single();

    if (error || !notice) {
      setSaving(false);
      toast(`登録に失敗しました: ${error?.message ?? ""}`);
      return;
    }

    const entries = Object.entries(files) as [AttachmentKind, File][];
    for (const [kind, file] of entries) {
      const path = `${teamId}/${notice.id}/${kind}-${Date.now()}.${safeExt(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("notice-attachments")
        .upload(path, file);
      if (uploadError) {
        toast(`${kind}のアップロードに失敗しました: ${uploadError.message}`);
        continue;
      }
      await supabase.from("notice_attachments").insert({
        notice_id: notice.id,
        kind,
        storage_path: path,
        file_name: file.name,
      });
    }

    setSaving(false);
    reset();
    onCreated();
  }

  return (
    <Modal open={open} onClose={onClose} title="お知らせを登録">
      <FieldLabel>タイトル</FieldLabel>
      <input
        className={inputClass()}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="例:体験会のお知らせ"
      />

      <div className="mt-3">
        <FieldLabel>本文</FieldLabel>
        <textarea
          rows={3}
          className={inputClass()}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="詳細を入力"
        />
      </div>

      <div className="mt-3">
        <FieldLabel>資料を添付</FieldLabel>
        <div className="flex gap-1.5 flex-wrap">
          {KINDS.map(({ kind, emoji }) => (
            <label
              key={kind}
              className={`flex-none px-3 py-2 rounded-[10px] text-[12.5px] font-bold border inline-flex items-center gap-1 cursor-pointer ${
                files[kind] ? "bg-orange text-white border-orange" : "bg-paper text-ink-soft border-line"
              }`}
            >
              {emoji} {kind}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => pickFile(kind, e.target.files?.[0])}
              />
            </label>
          ))}
        </div>
        <div className="mt-1.5">
          {Object.entries(files).map(([kind, file]) => (
            <div key={kind} className="text-xs text-ink-soft">
              {kind}: {file.name}
            </div>
          ))}
        </div>
        <div className="text-xs text-ink-soft mt-1.5">
          ※タップすると端末の「カメラロール」「ファイル」などから選べます
        </div>
      </div>

      <SubmitButton onClick={handleSubmit} disabled={saving}>
        {saving ? "登録中…" : "この内容で登録する"}
      </SubmitButton>
    </Modal>
  );
}
