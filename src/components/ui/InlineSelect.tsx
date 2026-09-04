"use client";

import { ChevronRightIcon } from "@/components/icons";

// 年度・検定名など、値を1つ選ぶための小さめのセレクトUI(MonthPickerと同じ方式)。
// iOSはappearance-noneを付けてもselect自体のネイティブ外観が完全には消えず、周囲の
// ボタン(SegButton等)よりも枠が太く見えることがあるため、実際のselectは透明にして
// タップ領域・ネイティブのドロップダウンUIだけを担わせ、見た目(枠線・文字・矢印アイコン)は
// 装飾用divで独立して描く。
export function InlineSelect({
  value,
  onChange,
  options,
  disabled,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <div className={`relative inline-block ${className}`}>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="peer absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer disabled:cursor-default"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <div
        aria-hidden
        className="pointer-events-none flex items-center whitespace-nowrap bg-white border border-line rounded-lg pl-3 pr-8 py-1.5 text-[12.5px] font-bold text-ink peer-focus-visible:ring-2 peer-focus-visible:ring-orange/40"
      >
        {current?.label ?? value}
      </div>
      <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
    </div>
  );
}
