"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { childFolders, folderPath, isDescendantOf } from "@/lib/libraryFolders";
import type { LibraryFolder } from "@/lib/database.types";

// 資料・フォルダの移動先を選ぶ、パンくずナビゲーション形式のフォルダピッカー。
// 外側(ページ)のフォルダ閲覧状態とは独立した、モーダル内だけのナビゲーション(browseFolderId)を持つ。
export function MoveModal({
  open,
  title,
  folders,
  currentFolderId,
  excludeFolderId,
  onClose,
  onMove,
}: {
  open: boolean;
  title: string;
  folders: LibraryFolder[];
  // 移動対象の現在の置き場所。移動先として同じ場所を選んだ場合はボタンを無効化する。
  currentFolderId: string | null;
  // フォルダ自体を移動する場合、自分自身とその子孫は移動先として選べない
  // (選んでも後でDBトリガーに拒否されるが、UI側でも最初から候補に出さない)。
  excludeFolderId?: string;
  onClose: () => void;
  onMove: (destinationFolderId: string | null) => Promise<void> | void;
}) {
  const [browseFolderId, setBrowseFolderId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (open) setBrowseFolderId(null);
  }, [open]);

  const pickableFolders = excludeFolderId
    ? folders.filter((f) => f.id !== excludeFolderId && !isDescendantOf(folders, f.id, excludeFolderId))
    : folders;

  const crumbs = folderPath(pickableFolders, browseFolderId);
  const children = childFolders(pickableFolders, browseFolderId);
  const isSameLocation = browseFolderId === currentFolderId;

  async function handleMoveHere() {
    setMoving(true);
    await onMove(browseFolderId);
    setMoving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex items-center gap-1 flex-wrap text-[12.5px] font-bold text-ink-soft mb-3">
        <button type="button" onClick={() => setBrowseFolderId(null)} className={browseFolderId === null ? "text-orange" : ""}>
          ホーム
        </button>
        {crumbs.map((c) => (
          <span key={c.id} className="flex items-center gap-1">
            <span>›</span>
            <button
              type="button"
              onClick={() => setBrowseFolderId(c.id)}
              className={browseFolderId === c.id ? "text-orange" : ""}
            >
              {c.name}
            </button>
          </span>
        ))}
      </div>

      {children.length === 0 ? (
        <div className="text-[12.5px] text-ink-soft mb-3">このフォルダの中にサブフォルダはありません</div>
      ) : (
        <div className="space-y-1.5 mb-3">
          {children.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setBrowseFolderId(f.id)}
              className="w-full flex items-center justify-between text-left px-3 py-2.5 rounded-lg border border-line bg-paper text-[13px] font-bold"
            >
              <span className="truncate">📁 {f.name}</span>
              <span className="text-ink-soft">›</span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleMoveHere}
        disabled={moving || isSameLocation}
        className="w-full text-center py-2.5 rounded-lg font-bold text-[12.5px] text-orange border border-orange bg-orange/8 disabled:opacity-40"
      >
        {moving ? "移動中…" : isSameLocation ? "現在の場所です" : "ここに移動する"}
      </button>
    </Modal>
  );
}
