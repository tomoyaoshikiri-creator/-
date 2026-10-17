"use client";

import { useSession } from "@/lib/session-context";

// 以前はタップするとアカウント・チーム運営メニューが開く仕組みだったが、名前を
// タップする操作が「わかりにくい・気づかない」との声が多かったため廃止し、
// その中身はNavDrawer(ハンバーガーメニュー)へ移した。ここは名前の表示のみ残す。
export function CurrentUserBadge() {
  const { name } = useSession();
  return (
    <span
      className="flex items-center max-w-[140px] px-2.5 py-1.5 rounded-lg"
      style={{ background: "var(--header-chip-surface)", color: "var(--header-chip-on)" }}
    >
      <span className="text-xs leading-none font-bold truncate max-w-full">{name}</span>
    </span>
  );
}
