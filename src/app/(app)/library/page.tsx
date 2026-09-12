"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { SegButton } from "@/components/ui/SegButton";
import { Fab } from "@/components/ui/Modal";
import { ChevronRightIcon } from "@/components/icons";
import { formatBytes } from "@/lib/format";
import { useSession } from "@/lib/session-context";
import { canManageLibrary } from "@/lib/permissions";
import { markTabSeen } from "@/lib/tabBadges";
import type { LibraryCategory, LibraryItem } from "@/lib/database.types";
import { NewLibraryFileModal } from "./NewLibraryFileModal";
import { EditCategoriesModal } from "./EditCategoriesModal";

// 1回のDB取得件数の上限。従来は範囲を絞らず全件取得しており、チームの活動年数が
// 長くなるほど取得件数が際限なく伸びる問題があった(docs/load-handling-todo.md)。
const LIBRARY_PAGE_SIZE = 30;

export default function LibraryPage() {
  const toast = useToast();
  const { teamId, userId, role } = useSession();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | "all">("all");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCategoriesOpen, setEditCategoriesOpen] = useState(false);
  const [usedBytes, setUsedBytes] = useState(0);
  const [limitBytes, setLimitBytes] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadUsage = useCallback(async () => {
    const supabase = createClient();
    const [{ data: team }, { data: usage }] = await Promise.all([
      supabase.from("teams").select("storage_limit_bytes").eq("id", teamId).single(),
      supabase.rpc("team_storage_usage_bytes"),
    ]);
    setLimitBytes(team?.storage_limit_bytes ?? 0);
    setUsedBytes(usage ?? 0);
  }, [teamId]);

  const loadCategories = useCallback(async () => {
    const supabase = createClient();
    const { data: cats } = await supabase.from("library_categories").select("*").order("name", { ascending: true });
    setCategories(cats ?? []);
  }, []);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const { data: libItems } = await supabase
      .from("library_items")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(LIBRARY_PAGE_SIZE + 1);
    const page = (libItems ?? []).slice(0, LIBRARY_PAGE_SIZE);
    setHasMore((libItems?.length ?? 0) > LIBRARY_PAGE_SIZE);
    setItems(page);
    setLoading(false);
  }, []);

  async function loadMore() {
    if (items.length === 0 || loadingMore) return;
    setLoadingMore(true);
    const supabase = createClient();
    const cursor = items[items.length - 1].created_at;
    const { data: libItems } = await supabase
      .from("library_items")
      .select("*")
      .lt("created_at", cursor)
      .order("created_at", { ascending: false })
      .limit(LIBRARY_PAGE_SIZE + 1);
    const page = (libItems ?? []).slice(0, LIBRARY_PAGE_SIZE);
    setHasMore((libItems?.length ?? 0) > LIBRARY_PAGE_SIZE);
    if (page.length > 0) {
      setItems((prev) => [...prev, ...page]);
    }
    setLoadingMore(false);
  }

  useEffect(() => {
    load();
    loadCategories();
    loadUsage();
  }, [load, loadCategories, loadUsage]);

  // ナビ再設計v3で「チーム」タブの赤丸に配下(ライブラリ含む)の未読を集約するようになったため、
  // notice/report/coach-noteと同じ既読記録パターンをここにも追加する(タブの表示内容自体は変更なし)。
  useEffect(() => {
    markTabSeen(userId, "library");
  }, [userId]);

  const visibleItems = selectedCategoryId === "all" ? items : items.filter((i) => i.category_id === selectedCategoryId);

  return (
    <PageShell
      header={<AppHeader title="ライブラリ" variant="detail" backHref="/team" />}
      fab={
        <>
          <Fab onClick={() => setModalOpen(true)} />
          <NewLibraryFileModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onCreated={() => {
              setModalOpen(false);
              load();
              loadCategories();
              loadUsage();
              toast("ファイルを追加しました");
            }}
          />
        </>
      }
    >
      {limitBytes > 0 && (
        <div className="bg-white border border-line rounded-lg px-3.5 py-2.5 mb-3.5">
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

      <SectionLabel
        action={
          canManageLibrary(role) &&
          categories.length > 0 && (
            <button
              type="button"
              onClick={() => setEditCategoriesOpen(true)}
              className="flex-none text-[11px] font-bold text-orange border border-orange rounded-full px-2.5 py-1 bg-orange/8"
            >
              カテゴリーを編集
            </button>
          )
        }
      >
        共有ファイル
      </SectionLabel>
      <EditCategoriesModal
        open={editCategoriesOpen}
        categories={categories}
        onClose={() => setEditCategoriesOpen(false)}
        onUpdated={loadCategories}
      />

      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : visibleItems.length === 0 ? (
        <EmptyState>まだファイルがありません</EmptyState>
      ) : (
        <>
          {visibleItems.map((item) => {
            const category = categories.find((c) => c.id === item.category_id);
            return (
              <Link key={item.id} href={`/library/${item.id}`}>
                <Card className="cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-[14.5px] truncate">
                      {category && (
                        <span className="font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-lg mr-1.5 bg-navy/8 text-navy">
                          {category.name}
                        </span>
                      )}
                      {item.title}
                    </div>
                    <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
                  </div>
                </Card>
              </Link>
            );
          })}
          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="block w-full mt-1 mb-2.5 text-center py-2 rounded-lg font-bold text-[12px] border border-line text-ink-soft bg-paper"
            >
              {loadingMore ? "読み込み中…" : "さらに読み込む"}
            </button>
          )}
        </>
      )}
    </PageShell>
  );
}
