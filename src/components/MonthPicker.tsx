"use client";

import { ChevronRightIcon } from "@/components/icons";
import { shiftYearMonth } from "@/lib/format";

// お知らせ・日報・コーチノートなど、月ごとに絞り込んで表示する一覧の先頭に置く年月ピッカー。
// デフォルトは当月。input type="month"はiPhone/iPadでは時刻選択と同じホイールUIになる。
export function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <button
        type="button"
        aria-label="前の月"
        onClick={() => onChange(shiftYearMonth(value, -1))}
        className="w-7 h-7 flex items-center justify-center rounded-[8px] border border-line bg-white text-ink-soft flex-shrink-0"
      >
        <ChevronRightIcon className="w-3.5 h-3.5 rotate-180" />
      </button>
      <input
        type="month"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="font-mono text-[13.5px] font-bold text-ink bg-white border border-line rounded-[8px] px-2.5 py-1"
      />
      <button
        type="button"
        aria-label="次の月"
        onClick={() => onChange(shiftYearMonth(value, 1))}
        className="w-7 h-7 flex items-center justify-center rounded-[8px] border border-line bg-white text-ink-soft flex-shrink-0"
      >
        <ChevronRightIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
