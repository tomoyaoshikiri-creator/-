"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { useUpgradePrompt } from "@/components/PlanLock";
import { Modal } from "@/components/ui/Modal";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { safeExt } from "@/lib/storagePath";
import { cleanupUploadedObjects, rollbackParentAndObjects } from "@/lib/storageCleanup";
import { formatBytes } from "@/lib/format";
import { resizeImageFile } from "@/lib/resizeImage";
import type { LibraryCategory } from "@/lib/database.types";

const NEW_CATEGORY_VALUE = "__new__";

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
  const promptUpgrade = useUpgradePrompt();

  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [usedBytes, setUsedBytes] = useState(0);
  const [limitBytes, setLimitBytes] = useState(0);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("library_categories")
      .select("*")
      .order("name", { ascending: true })
      .then(({ data }) => setCategories(data ?? []));
    Promise.all([
      supabase.from("teams").select("storage_limit_bytes").eq("id", teamId).single(),
      supabase.rpc("team_storage_usage_bytes"),
    ]).then(([{ data: team }, { data: usage }]) => {
      setLimitBytes(team?.storage_limit_bytes ?? 0);
      setUsedBytes(usage ?? 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reset() {
    setTitle("");
    setCategoryId("");
    setNewCategoryName("");
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

  async function resolveCategoryId(): Promise<string | null> {
    if (categoryId === NEW_CATEGORY_VALUE) {
      const name = newCategoryName.trim();
      if (!name) return null;
      const existing = categories.find((c) => c.name === name);
      if (existing) return existing.id;
      const { data, error } = await supabase
        .from("library_categories")
        .insert({ team_id: teamId, name })
        .select()
        .single();
      if (error || !data) {
        // 同時に同名カテゴリーが作られた場合など。既存のものを探して使う。
        const { data: existingRow } = await supabase
          .from("library_categories")
          .select("*")
          .eq("name", name)
          .maybeSingle();
        return existingRow?.id ?? null;
      }
      return data.id;
    }
    return categoryId || null;
  }

  async function handleSubmit() {
    if (!title.trim()) {
      toast("タイトルを入力してください");
      return;
    }
    if (files.length === 0) {
      toast("ファイルを選んでください");
      return;
    }
    const totalNewBytes = files.reduce((sum, f) => sum + f.size, 0);
    if (limitBytes > 0 && usedBytes + totalNewBytes > limitBytes) {
      promptUpgrade(
        `ストレージ容量(${formatBytes(limitBytes)})の上限を超えるためアップロードできません。既存のファイルを削除するか、プランをアップグレードしてください`,
      );
      return;
    }
    setSaving(true);
    const resolvedCategoryId = await resolveCategoryId();
    const itemId = crypto.randomUUID();

    // 1) 全ファイルをStorageへアップロードしきってから本体行を作る(1件でも失敗したら
    // 本体行自体を作らず、それまでにアップロード済みの分だけ後始末する)。
    const uploaded: { path: string; file: File; uploadFile: File }[] = [];
    for (const file of files) {
      const uploadFile = await resizeImageFile(file);
      const path = `${teamId}/${itemId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt(uploadFile.name)}`;
      const { error: uploadError } = await supabase.storage.from("library-files").upload(path, uploadFile);
      if (uploadError) {
        const cleanupOk = await cleanupUploadedObjects(
          supabase,
          uploaded.map((u) => ({ bucket: "library-files", path: u.path })),
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

    const { data: item, error } = await supabase
      .from("library_items")
      .insert({
        id: itemId,
        team_id: teamId,
        uploader_id: userId,
        category_id: resolvedCategoryId,
        title: title.trim(),
      })
      .select()
      .single();
    if (error || !item) {
      const cleanupOk = await cleanupUploadedObjects(
        supabase,
        uploaded.map((u) => ({ bucket: "library-files", path: u.path })),
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
      const { error: insertError } = await supabase.from("library_files").insert({
        library_item_id: item.id,
        storage_path: u.path,
        file_name: u.file.name,
        size_bytes: u.uploadFile.size,
      });
      if (insertError) {
        const rollbackOk = await rollbackParentAndObjects(supabase, {
          parentTable: "library_items",
          parentId: item.id,
          uploadedObjects: uploaded.map((x) => ({ bucket: "library-files", path: x.path })),
        });
        setSaving(false);
        toast(
          `${u.file.name}の登録に失敗しました: ${insertError.message}` +
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
    <Modal open={open} onClose={onClose} title="ファイルを追加">
      <FieldLabel>タイトル</FieldLabel>
      <input
        className={inputClass()}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="例:新人歓迎会の写真"
      />

      <div className="mt-3">
        <FieldLabel>カテゴリー</FieldLabel>
        <select className={inputClass()} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">カテゴリーなし</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={NEW_CATEGORY_VALUE}>+ 新しいカテゴリーを作る</option>
        </select>
        {categoryId === NEW_CATEGORY_VALUE && (
          <input
            className={inputClass("mt-2")}
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="新しいカテゴリー名"
          />
        )}
      </div>

      <div className="mt-3">
        <FieldLabel>画像・資料</FieldLabel>
        <label className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[12.5px] font-bold border border-line bg-paper text-ink-soft cursor-pointer">
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
        {saving ? "アップロード中…" : "追加する"}
      </SubmitButton>
    </Modal>
  );
}
