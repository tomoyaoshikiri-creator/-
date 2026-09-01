"use client";

import { CONFIRM_CLOSE_MESSAGE, useNavigationGuard } from "@/lib/navigationGuard";

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidthClass = "max-w-[420px]",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  // 選手選択モーダルなど、内容が短く狭い方が見やすい画面では狭いクラスを渡す。
  maxWidthClass?: string;
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
      className="fixed inset-0 bg-heading/50 flex items-end justify-center px-3 z-40"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className={`bg-white w-full ${maxWidthClass} rounded-t-[20px] p-4.5 pb-5.5 max-h-[85%] overflow-y-auto`}>
        <div className="font-display font-extrabold text-lg text-heading mb-3">{title}</div>
        {children}
      </div>
    </div>
  );
}

export function Fab({ onClick, label = "追加" }: { onClick: () => void; label?: string }) {
  // MASTER SPECIFICATION Visual Refresh: 背景はアプリ全体のPrimary Action色(--orange、
  // teamPrimaryのエイリアス。team未設定時はCIRCLE LINES Brand Blueへfallback)に統一する。
  // 文字色は任意のteamPrimaryでも可読性を確保するため、teamThemeStyle()が算出した
  // コントラスト安全な--on-team-primaryをそのまま使う(SubmitButton等の固定text-whiteとは
  // 異なり、ここは明示的にcontrast機構を利用する)。shadowも旧・緑固定値ではなく、
  // 現在のteamPrimaryと連動する色にする(color-mixで透明度を掛け合わせる)。
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute right-4 bottom-4 w-10 h-10 rounded-full bg-orange flex items-center justify-center text-xl font-bold z-10"
      style={{
        color: "var(--on-team-primary)",
        boxShadow: "0 10px 20px -6px color-mix(in srgb, var(--orange) 55%, transparent)",
      }}
    >
      +
    </button>
  );
}
