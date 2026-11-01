"use client";

import { PencilIcon } from "@/components/icons";

// CIRCLE LINESの共通「編集」操作ボタン。実施メニュー(PracticeMenuCard.tsx)で
// 最初に実装したデザイン(鉛筆アイコン+「編集」、薄いオレンジの枠線・背景)を
// 基準に共通コンポーネント化した。スケジュール関連の複数画面(予定の内容・
// 実施メニュー・本人の出欠)で同じ見た目を再利用する。
//
// 外側の<button>はmin-h-tap(44px)でタップ領域を確保し、内側の<span>が実際に
// 見える36px(h-9)のチップを描く(タップ領域と見た目の高さを分離する構造)。
// 角丸・文字サイズ・アイコンサイズはここに集約しているため、他画面へ展開する
// 際もこのコンポーネントを再利用すれば見た目が自動的に揃う。
//
// labelは既定で「編集」。対象が自明でない画面では、見た目のラベルを変えず
// ariaLabelだけをより具体的にするか、呼び出し側でlabel自体を変える(例:
// 「編集する」のような文言差異を吸収する)ことを想定している。
export function EditButton({
  onClick,
  label = "編集",
  ariaLabel,
  className = "",
}: {
  onClick: () => void;
  label?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      className={`min-h-tap flex-shrink-0 flex items-center justify-center ${className}`}
    >
      <span className="h-9 inline-flex items-center gap-1 px-2.5 rounded-control border border-orange/35 bg-orange/5 text-[12px] font-bold text-orange-text whitespace-nowrap">
        <PencilIcon className="w-3.5 h-3.5" />
        {label}
      </span>
    </button>
  );
}
