"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { useUpgradePrompt } from "@/components/PlanLock";
import { Modal } from "@/components/ui/Modal";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { safeExt } from "@/lib/storagePath";
import { removeUploadedObject } from "@/lib/storageCleanup";
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
    // TODO(SEC-02診断用・原因特定後に削除): ライブラリでファイル選択が反映されない不具合の調査のため一時的に追加。
    toast(`[診断] 検出したファイル数: ${newFiles ? newFiles.length : "null"}`);
    if (!newFiles) return;
    setFiles((prev) => [...prev, ...Array.from(newFiles)]);
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
    const { data: item, error } = await supabase
      .from("library_items")
      .insert({
        team_id: teamId,
        uploader_id: userId,
        category_id: resolvedCategoryId,
        title: title.trim(),
      })
      .select()
      .single();
    if (error || !item) {
      setSaving(false);
      toast(`登録に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    for (const file of files) {
      const uploadFile = await resizeImageFile(file);
      const path = `${teamId}/${item.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt(uploadFile.name)}`;
      const { error: uploadError } = await supabase.storage.from("library-files").upload(path, uploadFile);
      if (uploadError) {
        toast(`${file.name}のアップロードに失敗しました: ${uploadError.message}`);
        continue;
      }
      const { error: insertError } = await supabase.from("library_files").insert({
        library_item_id: item.id,
        storage_path: path,
        file_name: file.name,
        size_bytes: uploadFile.size,
      });
      if (insertError) {
        toast(`${file.name}の登録に失敗しました: ${insertError.message}`);
        await removeUploadedObject(supabase, "library-files", path);
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
        <label className="inline-flex items-center gap-1 px-3 py-2 rounded-[10px] text-[12.5px] font-bold border border-line bg-paper text-ink-soft cursor-pointer">
          📎 ファイルを選ぶ
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              try {
                addFiles(e.target.files);
              } catch (err) {
                toast(`[診断] 選択処理でエラー: ${err instanceof Error ? err.message : String(err)}`);
              }
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
