"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { Fab } from "@/components/ui/Modal";
import { loadProfilesMap } from "@/lib/profiles";
import { isImageFile } from "@/lib/storagePath";
import { formatDateLabel } from "@/lib/format";
import type { LibraryFile } from "@/lib/database.types";
import { NewLibraryFileModal } from "./NewLibraryFileModal";

type FileWithUrl = LibraryFile & { url: string | null };

export default function LibraryPage() {
  const toast = useToast();
  const [files, setFiles] = useState<FileWithUrl[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: f }, profMap] = await Promise.all([
      supabase.from("library_files").select("*").order("created_at", { ascending: false }),
      loadProfilesMap(supabase),
    ]);
    setProfiles(profMap);
    const withUrls = await Promise.all(
      (f ?? []).map(async (item) => {
        const { data: signed } = await supabase.storage.from("library-files").createSignedUrl(item.storage_path, 60 * 60);
        return { ...item, url: signed?.signedUrl ?? null };
      }),
    );
    setFiles(withUrls);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(item: FileWithUrl) {
    if (deleteConfirmId !== item.id) {
      setDeleteConfirmId(item.id);
      setTimeout(() => setDeleteConfirmId((cur) => (cur === item.id ? null : cur)), 3000);
      return;
    }
    setDeleteConfirmId(null);
    const supabase = createClient();
    await supabase.storage.from("library-files").remove([item.storage_path]);
    const { error } = await supabase.from("library_files").delete().eq("id", item.id);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    setFiles((prev) => prev.filter((f) => f.id !== item.id));
    toast("削除しました");
  }

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
              toast("ファイルを追加しました");
            }}
          />
        </>
      }
    >
      <SectionLabel>共有ファイル</SectionLabel>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : files.length === 0 ? (
        <EmptyState>まだファイルがありません</EmptyState>
      ) : (
        files.map((f) => (
          <Card key={f.id}>
            {f.url && isImageFile(f.file_name) ? (
              <a href={f.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={f.file_name} className="w-full rounded-[10px] border border-line object-contain mb-2" />
              </a>
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                {f.url && !isImageFile(f.file_name) ? (
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-[13.5px] text-orange truncate block"
                  >
                    📎 {f.file_name}
                  </a>
                ) : (
                  <div className="font-bold text-[13.5px] truncate">{f.file_name}</div>
                )}
                <div className="text-[11px] text-ink-soft mt-0.5">
                  {f.uploader_id ? (profiles[f.uploader_id] ?? "") : ""} ・ {formatDateLabel(f.created_at.slice(0, 10))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(f)}
                className="flex-none px-2.5 py-1.5 text-[11px] font-bold border rounded-[10px] bg-white"
                style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
              >
                {deleteConfirmId === f.id ? "もう一度タップで削除確定" : "削除"}
              </button>
            </div>
          </Card>
        ))
      )}
    </PageShell>
  );
}
