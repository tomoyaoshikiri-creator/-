"use client";

import { ChevronRightIcon } from "@/components/icons";

// 年度・検定名など、値を1つ選ぶための小さめのセレクトUI(MonthPickerと同じ方式)。
// 以前はselect自体を透明にして装飾用divを重ねる実装だったが、position:absolute +
// opacity:0のselectだとiOSがホイールピッカーではなく簡易的なポップアップメニューで
// 開くことがある不具合が報告されたため、select自体を(見た目を保ったまま)通常の
// 要素として表示する方式に変更した。appearance-noneで矢印だけ消し、代わりに
// ChevronRightIconを上に重ねて描く(pointer-events-noneなのでタップは下のselectへ
// 素通りする)。iOSはappearance-noneを付けてもselect自体のネイティブ外観(枠線)が
// 完全には消えないことがあるため、文字色・背景をselect本体に直接指定して違和感を
// 抑えている。
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
  return (
    <div className={`relative inline-block ${className}`}>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none w-full bg-white border border-line rounded-lg pl-3 pr-8 py-1.5 text-[16px] font-bold text-ink cursor-pointer disabled:cursor-default disabled:bg-paper disabled:text-ink-soft focus:outline-none focus:border-orange"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
    </div>
  );
}
