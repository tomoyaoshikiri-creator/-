"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { loadProfilesMap } from "@/lib/profiles";
import { isImageFile } from "@/lib/storagePath";
import { formatDateLabel } from "@/lib/format";
import { canManageLibrary } from "@/lib/permissions";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import type { LibraryCategory, LibraryFile, LibraryItem } from "@/lib/database.types";

type FileWithUrl = LibraryFile & { url: string | null };

export default function LibraryItemDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, role } = useSession();
  const canEdit = (item: LibraryItem | null) =>
    item !== null && (item.uploader_id === userId || canManageLibrary(role));
  const toast = useToast();

  const [item, setItem] = useState<LibraryItem | null>(null);
  const [files, setFiles] = useState<FileWithUrl[]>([]);
  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");

  useUnsavedChangesGuard(
    editing && item !== null && (title !== item.title || categoryId !== (item.category_id ?? "")),
  );

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: i }, { data: cats }, profMap] = await Promise.all([
      supabase.from("library_items").select("*").eq("id", params.id).maybeSingle(),
      supabase.from("library_categories").select("*").order("name", { ascending: true }),
      loadProfilesMap(supabase),
    ]);
    setItem(i ?? null);
    setCategories(cats ?? []);
    setProfiles(profMap);

    if (i) {
      const { data: libFiles } = await supabase.from("library_files").select("*").eq("library_item_id", i.id);
      const entries = await Promise.all(
        (libFiles ?? []).map(async (f) => {
          const { data: signed } = await supabase.storage.from("library-files").createSignedUrl(f.storage_path, 60 * 60);
          return { ...f, url: signed?.signedUrl ?? null };
        }),
      );
      setFiles(entries);
    } else {
      setFiles([]);
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit() {
    if (!item) return;
    setTitle(item.title);
    setCategoryId(item.category_id ?? "");
    setDeleteConfirm(false);
    setEditing(true);
  }

  async function handleSave() {
    if (!item) return;
    if (!title.trim()) {
      toast("タイトルを入力してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("library_items")
      .update({ title: title.trim(), category_id: categoryId || null })
      .eq("id", item.id);
    setSaving(false);
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }
    toast("更新しました");
    setEditing(false);
    load();
  }

  async function handleDelete() {
    if (!item) return;
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    const supabase = createClient();
    if (files.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("library-files")
        .remove(files.map((f) => f.storage_path));
      if (storageError) {
        toast(`削除に失敗しました: ${storageError.message}`);
        return;
      }
    }
    const { error } = await supabase.from("library_items").delete().eq("id", item.id);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    toast("削除しました");
    router.push("/library");
  }

  const category = item ? categories.find((c) => c.id === item.category_id) : undefined;

  return (
    <PageShell header={<AppHeader title="資料" variant="detail" backHref="/library" />}>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : !item ? (
        <EmptyState>資料が見つかりません</EmptyState>
      ) : editing ? (
        <>
          <SectionLabel>資料を編集</SectionLabel>
          <Card>
            <FieldLabel>タイトル</FieldLabel>
            <input className={inputClass()} value={title} onChange={(e) => setTitle(e.target.value)} />

            <div className="mt-3">
              <FieldLabel>カテゴリー</FieldLabel>
              <select className={inputClass()} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">カテゴリーなし</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <SubmitButton onClick={handleSave} disabled={saving}>
              {saving ? "保存中…" : "保存する"}
            </SubmitButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="w-full mt-2.5 text-center py-2 rounded-lg font-bold text-[12.5px] border border-line bg-white text-ink-soft"
            >
              キャンセル
            </button>
          </Card>

          <div className="font-mono text-[11px] tracking-widest uppercase text-ink-soft mt-4 mb-2.5">削除</div>
          <Card>
            <button
              type="button"
              onClick={handleDelete}
              className="w-full text-center py-2 rounded-lg font-bold text-[12.5px] border bg-white"
              style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            >
              {deleteConfirm ? "もう一度タップで削除確定" : "この資料を削除する"}
            </button>
          </Card>
        </>
      ) : (
        <>
          <SectionLabel
            action={
              canEdit(item) && (
                <button
                  type="button"
                  onClick={startEdit}
                  className="flex-none text-[11px] font-bold text-orange border border-orange rounded-full px-2.5 py-1 bg-orange/8"
                >
                  編集する
                </button>
              )
            }
          >
            資料情報
          </SectionLabel>
          <Card>
            <div className="font-bold text-[14.5px]">
              {category && (
                <span className="font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-lg mr-1.5 bg-navy/8 text-navy">
                  {category.name}
                </span>
              )}
              {item.title}
            </div>
            <div className="text-[11px] text-ink-soft mt-1">
              {item.uploader_id ? (profiles[item.uploader_id] ?? "") : ""} ・ {formatDateLabel(item.created_at.slice(0, 10))}
            </div>

            {files.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                {files.map((f) =>
                  f.url && isImageFile(f.file_name) ? (
                    <a key={f.id} href={f.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={f.url}
                        alt={f.file_name}
                        className="w-full rounded-lg border border-line object-contain"
                      />
                    </a>
                  ) : f.url ? (
                    <a
                      key={f.id}
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-orange font-bold text-xs"
                    >
                      📎 {f.file_name}
                    </a>
                  ) : null,
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </PageShell>
  );
}
