import type { HTMLAttributes } from "react";
import { InboxIcon } from "@/components/icons";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-white border border-line rounded-lg px-4 py-3.5 mb-2.5 ${className}`}
      {...props}
    />
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
