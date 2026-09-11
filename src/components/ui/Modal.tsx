"use client";

import { useEffect, useId, useRef } from "react";
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
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // 開く直前にフォーカスしていた要素を覚えておき、閉じたときに戻す(スクリーンリーダー
  // ユーザーが元の操作位置を見失わないようにするため)。
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  function handleClose() {
    if (isDirty && !window.confirm(CONFIRM_CLOSE_MESSAGE)) return;
    onClose();
  }

  // Escキーのイベントリスナーは開いている間ずっと同じ関数を使い回す(毎レンダー
  // 付け外ししない)。そのためhandleCloseを直接クロージャに閉じ込めず、
  // 常に最新のisDirty/onCloseを読めるようrefで橋渡しする(refへの書き込みは
  // レンダー中に行えないため、毎レンダー走るeffectで更新する)。
  const handleCloseRef = useRef(handleClose);
  useEffect(() => {
    handleCloseRef.current = handleClose;
  });

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleCloseRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-heading/50 flex items-end justify-center px-3 z-40"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-white w-full ${maxWidthClass} rounded-t-[20px] p-4.5 pb-5.5 max-h-[85%] overflow-y-auto outline-none`}
      >
        <div id={titleId} className="font-display font-extrabold text-lg text-heading mb-3">
          {title}
        </div>
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
      className="absolute right-4 bottom-4 w-10 h-10 rounded-full border border-orange flex items-center justify-center text-xl font-bold z-10"
      style={{
        color: "var(--on-team-primary)",
        // SubmitButton/SegButtonと同じ135deg・濃い色(左上)→薄い色(右下)のグラデーション。
        // 薄い方は黒を混ぜず、白を混ぜて明るくする。
        background:
          "linear-gradient(135deg, var(--orange) 0%, color-mix(in srgb, var(--orange) 55%, white) 100%)",
        boxShadow: "0 10px 20px -6px color-mix(in srgb, var(--orange) 55%, transparent)",
      }}
    >
      +
    </button>
  );
}
