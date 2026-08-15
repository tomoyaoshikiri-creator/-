"use client";

import { ChevronRightIcon } from "@/components/icons";
import { monthLabel, shiftYearMonth } from "@/lib/format";

// お知らせ・日報・コーチノートなど、月ごとに絞り込んで表示する一覧の先頭に置く年月ピッカー。
// デフォルトは当月で、◀▶か直接ドロップダウンから選んだ月に切り替える。
function monthOptions(rangeMonths = 36): string[] {
  const options: string[] = [];
  const now = new Date();
  for (let i = rangeMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return options;
}

const OPTIONS = monthOptions();

export function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = OPTIONS.includes(value) ? OPTIONS : [...OPTIONS, value].sort();
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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-[13.5px] font-bold text-ink bg-white border border-line rounded-[8px] px-2.5 py-1"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {monthLabel(o)}
          </option>
        ))}
      </select>
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
