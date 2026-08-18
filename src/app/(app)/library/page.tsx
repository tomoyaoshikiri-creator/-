"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { SegButton } from "@/components/ui/SegButton";
import { Fab } from "@/components/ui/Modal";
import { loadProfilesMap } from "@/lib/profiles";
import { isImageFile } from "@/lib/storagePath";
import { formatBytes, formatDateLabel } from "@/lib/format";
import { useSession } from "@/lib/session-context";
import type { LibraryCategory, LibraryFile, LibraryItem } from "@/lib/database.types";
import { NewLibraryFileModal } from "./NewLibraryFileModal";

type FileWithUrl = LibraryFile & { url: string | null };
type ItemWithFiles = LibraryItem & { files: FileWithUrl[] };

export default function LibraryPage() {
  const toast = useToast();
  const { teamId } = useSession();
  const [items, setItems] = useState<ItemWithFiles[]>([]);
  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | "all">("all");
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [usedBytes, setUsedBytes] = useState(0);
  const [limitBytes, setLimitBytes] = useState(0);

  const loadUsage = useCallback(async () => {
    const supabase = createClient();
    const [{ data: team }, { data: usage }] = await Promise.all([
      supabase.from("teams").select("storage_limit_bytes").eq("id", teamId).single(),
      supabase.rpc("team_storage_usage_bytes"),
    ]);
    setLimitBytes(team?.storage_limit_bytes ?? 0);
    setUsedBytes(usage ?? 0);
  }, [teamId]);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: cats }, { data: libItems }, profMap] = await Promise.all([
      supabase.from("library_categories").select("*").order("name", { ascending: true }),
      supabase.from("library_items").select("*").order("created_at", { ascending: false }),
      loadProfilesMap(supabase),
    ]);
    setCategories(cats ?? []);
    setProfiles(profMap);

    const itemIds = (libItems ?? []).map((i) => i.id);
    let filesByItem: Record<string, FileWithUrl[]> = {};
    if (itemIds.length > 0) {
      const { data: files } = await supabase.from("library_files").select("*").in("library_item_id", itemIds);
      const entries = await Promise.all(
        (files ?? []).map(async (f) => {
          const { data: signed } = await supabase.storage.from("library-files").createSignedUrl(f.storage_path, 60 * 60);
          return { ...f, url: signed?.signedUrl ?? null };
        }),
      );
      filesByItem = {};
      entries.forEach((f) => {
        (filesByItem[f.library_item_id] ??= []).push(f);
      });
    }

    setItems((libItems ?? []).map((i) => ({ ...i, files: filesByItem[i.id] ?? [] })));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    loadUsage();
  }, [load, loadUsage]);

  async function handleDelete(item: ItemWithFiles) {
    if (deleteConfirmId !== item.id) {
      setDeleteConfirmId(item.id);
      setTimeout(() => setDeleteConfirmId((cur) => (cur === item.id ? null : cur)), 3000);
      return;
    }
    setDeleteConfirmId(null);
    const supabase = createClient();
    if (item.files.length > 0) {
      await supabase.storage.from("library-files").remove(item.files.map((f) => f.storage_path));
    }
    const { error } = await supabase.from("library_items").delete().eq("id", item.id);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    toast("削除しました");
    loadUsage();
  }

  const visibleItems = selectedCategoryId === "all" ? items : items.filter((i) => i.category_id === selectedCategoryId);

  return (
    <PageShell
      header={<AppHeader title="ライブラリ" />}
      fab={
        <>
          <Fab onClick={() => setModalOpen(true)} />
          <NewLibraryFileModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onCreated={() => {
              setModalOpen(false);
              load();
              loadUsage();
              toast("ファイルを追加しました");
            }}
          />
        </>
      }
    >
      {limitBytes > 0 && (
        <div className="bg-white border border-line rounded-2xl px-3.5 py-2.5 mb-3.5">
          <div className="flex items-end justify-between">
            <div className="font-bold text-[15px]">
              {formatBytes(usedBytes)}
              <span className="text-[11px] font-normal text-ink-soft ml-1">使用中</span>
            </div>
            <div className="text-[11px] text-ink-soft mb-0.5">/ {formatBytes(limitBytes)}</div>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-paper overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (usedBytes / limitBytes) * 100)}%`,
                background: usedBytes >= limitBytes ? "var(--danger)" : "var(--orange)",
              }}
            />
          </div>
          {usedBytes >= limitBytes && (
            <div className="text-[11px] mt-1.5" style={{ color: "var(--danger)" }}>
              容量の上限に達しています。新規アップロードするには、ファイルを削除するか上位プランへのアップグレードが必要です。
            </div>
          )}
        </div>
      )}

      {categories.length > 0 && (
        <div className="flex gap-2 mb-3.5 flex-wrap">
          <SegButton variant="small" active={selectedCategoryId === "all"} onClick={() => setSelectedCategoryId("all")}>
            すべて
          </SegButton>
          {categories.map((c) => (
            <SegButton
              key={c.id}
              variant="small"
              active={selectedCategoryId === c.id}
              onClick={() => setSelectedCategoryId(c.id)}
            >
              {c.name}
            </SegButton>
          ))}
        </div>
      )}

      <SectionLabel>共有ファイル</SectionLabel>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : visibleItems.length === 0 ? (
        <EmptyState>まだファイルがありません</EmptyState>
      ) : (
        visibleItems.map((item) => {
          const category = categories.find((c) => c.id === item.category_id);
          return (
            <Card key={item.id}>
              <div className="font-bold text-[14.5px]">
                {category && (
                  <span className="font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-md mr-1.5 bg-navy/8 text-navy">
                    {category.name}
                  </span>
                )}
                {item.title}
              </div>
              <div className="text-[11px] text-ink-soft mt-1">
                {item.uploader_id ? (profiles[item.uploader_id] ?? "") : ""} ・ {formatDateLabel(item.created_at.slice(0, 10))}
              </div>

              {item.files.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {item.files.map((f) =>
                    f.url && isImageFile(f.file_name) ? (
                      <a key={f.id} href={f.url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.url}
                          alt={f.file_name}
                          className="w-full rounded-[10px] border border-line object-contain"
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

              <button
                type="button"
                onClick={() => handleDelete(item)}
                className="mt-2.5 w-full text-center py-1.5 rounded-[8px] font-bold text-[11px] border bg-white"
                style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
              >
                {deleteConfirmId === item.id ? "もう一度タップで削除確定" : "削除"}
              </button>
            </Card>
          );
        })
      )}
    </PageShell>
  );
}
