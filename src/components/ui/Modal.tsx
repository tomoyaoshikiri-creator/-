"use client";

import { CONFIRM_CLOSE_MESSAGE, useNavigationGuard } from "@/lib/navigationGuard";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  // モーダルを閉じる操作(背景タップなど)はページ遷移を伴わないため<GuardedLink>では捕まえられない。
  // ここで直接、未保存の変更が無いか確認してから閉じる。
  const { isDirty } = useNavigationGuard();

  if (!open) return null;

  function handleClose() {
    if (isDirty && !window.confirm(CONFIRM_CLOSE_MESSAGE)) return;
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-navy/50 flex items-end justify-center px-3 z-40"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="bg-white w-full max-w-[420px] rounded-t-[20px] p-4.5 pb-5.5 max-h-[85%] overflow-y-auto">
        <div className="font-display font-extrabold text-lg text-navy mb-3">{title}</div>
        {children}
      </div>
    </div>
  );
}

export function Fab({ onClick, label = "追加" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute right-4 bottom-4 w-10 h-10 rounded-full bg-green text-white flex items-center justify-center text-xl font-bold shadow-[0_10px_20px_-6px_rgba(62,132,98,0.55)] z-10"
    >
      +
    </button>
  );
}
