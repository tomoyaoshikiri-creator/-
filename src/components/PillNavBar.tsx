"use client";

import type { ReactNode } from "react";

type PillNavIcon = (props: { className?: string }) => React.ReactElement;

// CIRCLE LINESの新しい共通ボトムナビデザイン「フローティング型のピル型ナビゲーション」。
// 画面下部に左右の余白を設けて浮かせる横長ピル・白系背景・控えめな境界線と影・
// アイコン上/ラベル下、という見た目をここに集約する。
//
// 今回はスタッツ入力画面の専用4ボタン(操作バー)にのみ適用し、通常の下部5タブ
// (TabBar.tsx/Sidebar.tsx)は変更しない。ただしPhase 3で5タブ側にも同じ見た目を
// 適用する前提で、サイズ定数とこの外枠コンポーネントを再利用できる形にしている。
// TabBar(アイコン23px/ラベル9.5px)と同じ値を使う。

export const PILL_NAV_ICON_CLASS = "w-[23px] h-[23px]";
export const PILL_NAV_LABEL_CLASS = "text-[9.5px] font-bold leading-none whitespace-nowrap";

// 画面下部に浮かせる位置決めだけを担う外枠(左右マージン・セーフエリア対応)。
// 中身の形(ピル/サブパネルのカード)を問わず共通で使う。
//
// 実機確認で、下端からの余白がcalc(0.875rem + env(safe-area-inset-bottom))だと
// 離れすぎて見えることが判明した。TabBar.tsx側の過去の調査(ホームインジケーター
// 領域はpadding-bottom等で追加の余白を確保しても見た目の保護領域が増えず、
// 単に余白だけが増える)と同じ理由と考えられるため、固定の余白とsafe-area-inset-bottomを
// 加算せず、大きい方を採用するmax()に変更する。これにより、safe-area-inset-bottomが
// 大きい端末でも最低限それを下回らず、かつ0や小さい環境(Android Chrome等)では
// 単純に下端から0.875rem(14px、目安の12〜16pxの範囲内)になる。
export function PillNavPosition({ children }: { children: ReactNode }) {
  return (
    <div
      className="absolute left-3 right-3 z-10"
      style={{ bottom: "max(0.875rem, env(safe-area-inset-bottom))" }}
    >
      {children}
    </div>
  );
}

// ピル自体の外枠(横長・最大角丸・白背景・控えめな境界線と影)。操作ボタン
// (PillNavButton)・将来のナビリンクのどちらも子要素として並べられるよう、
// 見た目(形)のみを担う。位置決めはPillNavPositionが担当する。
export function PillNavBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-stretch rounded-full border border-line bg-white shadow-card overflow-hidden">
      {children}
    </div>
  );
}

// 画面遷移ではなく「操作」を表すボタン(取り消し/交代/タイムアウト/その他など)。
// ナビゲーションのタブと違い選択中の常時ハイライトは持たず、押下時のフィードバック
// (active:bg-paper)と無効時の表示(opacity-40 + disabled)だけを持つ。
export function PillNavButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  tone = "default",
}: {
  icon: PillNavIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 min-h-tap flex flex-col items-center justify-center gap-1 py-2.5 transition-colors active:bg-paper ${
        tone === "danger" ? "text-danger-text" : "text-ink-soft"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <Icon className={PILL_NAV_ICON_CLASS} />
      <span className={PILL_NAV_LABEL_CLASS}>{label}</span>
    </button>
  );
}

// ボタン間の縦の区切り線。ピル自体の角丸・外枠とぶつからないよう、ボタン本体とは
// 別のdivとして各ボタンの間にだけ挿入する(最初のボタンの前には入れない)。
export function PillNavDivider() {
  return <div className="w-px bg-line self-stretch my-2" aria-hidden />;
}
