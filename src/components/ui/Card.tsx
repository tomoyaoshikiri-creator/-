import type { HTMLAttributes } from "react";
import Link from "next/link";
import { InboxIcon, ChevronRightIcon } from "@/components/icons";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-white border border-line rounded-lg px-4 py-3.5 mb-2.5 ${className}`}
      {...props}
    />
  );
}

// 2026-10-24 UI刷新: PATH KARTE基準(docs/design-system.md)の新しいカードの見た目
// (角丸14px・shadow-card・bg-card/border-border-subtle)。既存のCard(上記、角丸6px・
// 枠線のみ)はどの画面でも見た目を変えないためそのまま残し、刷新する画面から順に
// このclassNameへ置き換えていく(Phase 2以降、画面ごとに適用)。
export const cardClass = "bg-card border border-border-subtle rounded-card p-3 shadow-card mb-2.5 md:p-4";

// 一覧・カードの下部に置く「すべて見る」系の遷移行。タップ領域・見た目を画面間で統一する
// (2026-10-24 UI刷新)。カード内の最後の要素として使うことを想定し、上に区切り線を持つ。
export function CardFooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-tap items-center justify-between gap-2 mt-1 pt-2 border-t border-line text-caption font-bold text-orange-text"
    >
      <span>{children}</span>
      <ChevronRightIcon className="w-3.5 h-3.5 flex-shrink-0" />
    </Link>
  );
}

export function SectionLabel({
  children,
  align = "left",
  action,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  // ラベルと反対側(線の外側の端)に置く任意の操作ボタンなど。ラベルがleftなら右端、
  // rightなら左端に来るため、左右対称な画面でも自然に対角の配置になる。
  action?: React.ReactNode;
}) {
  const line = <span className="flex-1 h-px bg-line" />;
  const label = <span>{children}</span>;
  return (
    <div className="font-mono text-[13px] font-bold tracking-widest uppercase text-ink mb-2.5 flex items-center gap-2">
      {align === "right" ? (
        <>
          {action}
          {line}
          {label}
        </>
      ) : (
        <>
          {label}
          {line}
          {action}
        </>
      )}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  // 「読み込み中…」は読み込み中であって空データではないため、アイコンは出さない
  // (アプリ全体でこの文言はEmptyStateのloading表示として一貫して使われている)。
  const isLoading = children === "読み込み中…";
  return (
    <div className="text-[12.5px] text-ink-soft text-center py-5">
      {!isLoading && <InboxIcon className="w-7 h-7 mx-auto mb-2 opacity-40" />}
      {children}
    </div>
  );
}
