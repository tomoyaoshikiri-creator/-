import { ChevronRightIcon } from "@/components/icons";

// 開閉する欄(2026-10-24 UI刷新 Phase 1。見た目のルールはPATH KARTEのdocs/design-system.md)。
// ブラウザ標準のdetails/summaryを使う(キーボード・読み上げに対応し、複数を同時に開ける。
// JS側で開閉状態を持つ必要がないため"use client"は不要)。開閉の印は右端のアイコンで、
// 閉じている間は下向き、開くと上向きになる(ChevronRightIconを回転させて流用し、
// 既存のInlineSelect等と同じ矢印の見た目に揃える)。
export function Accordion({
  summary,
  children,
  defaultOpen = false,
  className = "",
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details open={defaultOpen} className={`group ${className}`}>
      <summary className="flex min-h-tap cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">{summary}</span>
        <ChevronRightIcon className="w-4 h-4 text-ink-soft flex-shrink-0 rotate-90 transition-transform group-open:-rotate-90" />
      </summary>
      {children}
    </details>
  );
}
