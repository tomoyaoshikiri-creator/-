import type { HTMLAttributes } from "react";

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
  return <div className="text-[12.5px] text-ink-soft text-center py-5">{children}</div>;
}
