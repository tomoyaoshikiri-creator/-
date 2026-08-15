"use client";

import { useState } from "react";
import { ChevronRightIcon } from "@/components/icons";

// お知らせ・日報・コーチノートなど、投稿が積み上がっていく一覧を月ごとに折りたたんで見せるための共通部品。
// 直近の月だけ開いた状態で表示し、それより前の月はタップで開閉する。
export function MonthGroup({
  label,
  count,
  defaultOpen,
  children,
}: {
  label: string;
  count: number;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 mb-2.5">
        <span className="font-mono text-[13px] font-bold tracking-widest uppercase text-ink whitespace-nowrap">
          {label}
        </span>
        <span className="font-mono text-[11px] font-bold text-ink-soft">{count}</span>
        <span className="flex-1 h-px bg-line" />
        <ChevronRightIcon
          className={`w-3.5 h-3.5 text-ink-soft flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && children}
    </div>
  );
}
