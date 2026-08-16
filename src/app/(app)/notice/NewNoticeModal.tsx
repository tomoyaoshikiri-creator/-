"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { SegButton, SubmitButton, FieldLabel, inputClass } from "@/components/ui/SegButton";
import { attachmentKindSlug, safeExt } from "@/lib/storagePath";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { canPostTeacherOnlyNotice } from "@/lib/permissions";
import type { AttachmentKind, NoticeAudience } from "@/lib/database.types";

const KINDS: { kind: AttachmentKind; emoji: string }[] = [
  { kind: "対戦表", emoji: "📋" },
  { kind: "配車表", emoji: "🚗" },
  { kind: "その他", emoji: "📎" },
];

const AUDIENCES: NoticeAudience[] = ["全員", "指導者のみ", "運営以上", "学年指定"];

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
  const { userId, teamId, role } = useSession();
  const toast = useToast();

  const audiences = canPostTeacherOnlyNotice(role) ? AUDIENCES : AUDIENCES.filter((a) => a !== "指導者のみ");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<NoticeAudience>("全員");
  const [targetGradeMin, setTargetGradeMin] = useState("");
  const [files, setFiles] = useState<Partial<Record<AttachmentKind, File>>>({});
  const [saving, setSaving] = useState(false);

  useUnsavedChangesGuard(
    open &&
      (title.trim() !== "" ||
        body.trim() !== "" ||
        audience !== "全員" ||
        targetGradeMin !== "" ||
        Object.keys(files).length > 0),
  );

  function reset() {
    setTitle("");
    setBody("");
    setAudience("全員");
    setTargetGradeMin("");
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
    if (audience === "学年指定" && !targetGradeMin) {
      toast("対象学年を選択してください");
      return;
    }
    setSaving(true);

    const { data: notice, error } = await supabase
      .from("notices")
      .insert({
        team_id: teamId,
        title: title.trim(),
        body: body.trim() || null,
        sender_id: userId,
        audience,
        target_grade_min: audience === "学年指定" ? targetGradeMin : null,
      })
      .select()
      .single();

    if (error || !notice) {
      setSaving(false);
      toast(`登録に失敗しました: ${error?.message ?? ""}`);
      return;
    }

    const entries = Object.entries(files) as [AttachmentKind, File][];
    for (const [kind, file] of entries) {
      const path = `${teamId}/${notice.id}/${attachmentKindSlug(kind)}-${Date.now()}.${safeExt(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("notice-attachments")
        .upload(path, file);
      if (uploadError) {
        toast(`${kind}のアップロードに失敗しました: ${uploadError.message}`);
        continue;
      }
      const { error: attachError } = await supabase.from("notice_attachments").insert({
        notice_id: notice.id,
        kind,
        storage_path: path,
        file_name: file.name,
      });
      if (attachError) {
        toast(`${kind}の登録に失敗しました: ${attachError.message}`);
      }
    }

    setSaving(false);
    reset();
    // プッシュ通知の送信はベストエフォート。鍵未設定や送信失敗があっても
    // お知らせの登録自体は完了しているので、ここでは結果を待たず・エラーも無視する
    // (失敗の詳細はサーバー側のログ(/api/push/notify)に残る)。
    fetch("/api/push/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "新しいお知らせ", body: notice.title, url: `/notice/${notice.id}` }),
    }).catch(() => {});
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
        <FieldLabel>公開範囲</FieldLabel>
        <div className="flex gap-1.5 flex-wrap">
          {audiences.map((a) => (
            <SegButton key={a} variant="small" active={audience === a} onClick={() => setAudience(a)} className="flex-none px-3">
              {a}
            </SegButton>
          ))}
        </div>
        <div className="text-xs text-ink-soft mt-1">指導者・管理者は公開範囲に関わらず常にすべてのお知らせを見られます</div>
        {audience === "学年指定" && (
          <select
            className={inputClass("mt-2")}
            value={targetGradeMin}
            onChange={(e) => setTargetGradeMin(e.target.value)}
          >
            <option value="">対象学年を選択してください</option>
            {["1", "2", "3", "4", "5", "6"].map((g) => (
              <option key={g} value={g}>
                {g}年生以上
              </option>
            ))}
          </select>
        )}
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
