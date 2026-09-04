"use client";

import { ChevronRightIcon } from "@/components/icons";
import { monthLabel, shiftYearMonth } from "@/lib/format";

// お知らせ・日報・コーチノートなど、月ごとに絞り込んで表示する一覧の先頭に置く年月ピッカー。
// デフォルトは当月。input type="month"はiPhone/iPadでは時刻選択と同じホイールUIになる。
export function MonthPicker({
  value,
  onChange,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  // "YYYY-MM"。指定すると、これより前の月には移動できなくなる(プランによる閲覧範囲制限用)。
  min?: string;
}) {
  const atMin = Boolean(min && value <= min);
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <button
        type="button"
        aria-label="前の月"
        onClick={() => !atMin && onChange(shiftYearMonth(value, -1))}
        disabled={atMin}
        className="w-7 h-7 flex items-center justify-center rounded-lg border border-line bg-white text-ink-soft flex-shrink-0 disabled:opacity-40"
      >
        <ChevronRightIcon className="w-3.5 h-3.5 rotate-180" />
      </button>
      <div className="relative flex-shrink-0">
        {/* iOSのtype="month"はappearance-noneを付けてもネイティブのコントロール外観が
            完全には消えず、矢印ボタンより枠が太く見えてしまう(WebKitの既知の制限)。
            そのため実際のinputは透明にしてタップ領域・ネイティブのホイールUIだけを担わせ、
            見た目(枠線・文字)は矢印ボタンと全く同じCSSで描く装飾用divに分離する。 */}
        <input
          type="month"
          value={value}
          min={min}
          onChange={(e) =>
            e.target.value && onChange(e.target.value < (min ?? e.target.value) ? min! : e.target.value)
          }
          aria-label="表示する年月"
          className="peer absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer"
        />
        <div
          aria-hidden
          className="pointer-events-none font-mono text-[13.5px] font-bold text-ink bg-white border border-line rounded-lg px-3 py-1 leading-normal peer-focus-visible:ring-2 peer-focus-visible:ring-orange/40"
        >
          {monthLabel(value)}
        </div>
      </div>
      <button
        type="button"
        aria-label="次の月"
        onClick={() => onChange(shiftYearMonth(value, 1))}
        className="w-7 h-7 flex items-center justify-center rounded-lg border border-line bg-white text-ink-soft flex-shrink-0"
      >
        <ChevronRightIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
