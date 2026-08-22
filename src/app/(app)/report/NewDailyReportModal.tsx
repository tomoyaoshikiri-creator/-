"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { safeExt } from "@/lib/storagePath";
import { cleanupUploadedObjects, rollbackParentAndObjects } from "@/lib/storageCleanup";
import { resizeImageFile } from "@/lib/resizeImage";
import { DateSelect, DATE_OPTIONS } from "./DateSelect";

export function NewDailyReportModal({
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
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  useUnsavedChangesGuard(open && (body.trim() !== "" || files.length > 0));

  function reset() {
    setDateValue(todayValue);
    setBody("");
    setFiles([]);
  }

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    // 一部端末でArray.from(FileList)がFileListの反復に失敗し空配列になる事象への対策として、
    // インデックスで1件ずつ取り出す(FileList.item()経由)方式にしている。
    const picked: File[] = [];
    for (let i = 0; i < newFiles.length; i++) {
      const f = newFiles.item(i);
      if (f) picked.push(f);
    }
    setFiles((prev) => [...prev, ...picked]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!body.trim()) {
      toast("内容を入力してください");
      return;
    }
    setSaving(true);
    const reportId = crypto.randomUUID();

    // 1) 全ファイルをStorageへアップロードしきってから本体行を作る(1件でも失敗したら
    // 本体行自体を作らず、それまでにアップロード済みの分だけ後始末する)。
    const uploaded: { path: string; file: File; uploadFile: File }[] = [];
    for (const file of files) {
      const uploadFile = await resizeImageFile(file);
      const path = `${teamId}/${reportId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt(uploadFile.name)}`;
      const { error: uploadError } = await supabase.storage.from("daily-report-attachments").upload(path, uploadFile);
      if (uploadError) {
        const cleanupOk = await cleanupUploadedObjects(
          supabase,
          uploaded.map((u) => ({ bucket: "daily-report-attachments", path: u.path })),
        );
        setSaving(false);
        toast(
          `${file.name}のアップロードに失敗しました: ${uploadError.message}` +
            (cleanupOk ? "" : "(後片付けにも失敗しました。管理者にご確認ください)"),
        );
        return;
      }
      uploaded.push({ path, file, uploadFile });
    }

    const { data: report, error } = await supabase
      .from("daily_reports")
      .insert({
        id: reportId,
        team_id: teamId,
        author_id: userId,
        date: dateValue,
        body: body.trim(),
      })
      .select()
      .single();
    if (error || !report) {
      const cleanupOk = await cleanupUploadedObjects(
        supabase,
        uploaded.map((u) => ({ bucket: "daily-report-attachments", path: u.path })),
      );
      setSaving(false);
      toast(
        `登録に失敗しました: ${error?.message ?? ""}` +
          (cleanupOk ? "" : "(後片付けにも失敗しました。管理者にご確認ください)"),
      );
      return;
    }

    // 2) 添付行をINSERT。1件でも失敗したら本体行を削除(cascadeで添付行も消える)し、
    // アップロード済みの全Storageオブジェクトを後始末して、部分成功を許さない。
    for (const u of uploaded) {
      const { error: attachError } = await supabase.from("daily_report_attachments").insert({
        daily_report_id: report.id,
        storage_path: u.path,
        file_name: u.file.name,
        size_bytes: u.uploadFile.size,
      });
      if (attachError) {
        const rollbackOk = await rollbackParentAndObjects(supabase, {
          parentTable: "daily_reports",
          parentId: report.id,
          uploadedObjects: uploaded.map((x) => ({ bucket: "daily-report-attachments", path: x.path })),
        });
        setSaving(false);
        toast(
          `${u.file.name}の登録に失敗しました: ${attachError.message}` +
            (rollbackOk ? "" : "(後片付けにも失敗しました。管理者にご確認ください)"),
        );
        return;
      }
    }

    setSaving(false);
    reset();
    onCreated();
  }

  return (
    <Modal open={open} onClose={onClose} title="チーム日報を書く">
      <FieldLabel>日付</FieldLabel>
      <DateSelect value={dateValue} onChange={setDateValue} />
      <div className="mt-3">
        <FieldLabel>内容</FieldLabel>
        <textarea
          rows={3}
          className={inputClass()}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="今日の練習についての気づきや共有事項"
        />
      </div>
      <div className="mt-3">
        <FieldLabel>画像・資料を添付</FieldLabel>
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
      </div>
      <SubmitButton onClick={handleSubmit} disabled={saving}>
        {saving ? "登録中…" : "登録する"}
      </SubmitButton>
    </Modal>
  );
}
