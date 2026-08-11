import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-white border border-line rounded-2xl px-4 py-3.5 mb-2.5 ${className}`}
      {...props}
    />
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[13px] font-bold tracking-widest uppercase text-ink mb-2.5 flex items-center gap-2">
      <span>{children}</span>
      <span className="flex-1 h-px bg-line" />
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="text-[12.5px] text-ink-soft text-center py-5">{children}</div>;
}
