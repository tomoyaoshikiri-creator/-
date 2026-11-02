"use client";

import type { ReactNode } from "react";
import { GuardedLink } from "@/components/GuardedLink";

export type PillNavIcon = (props: { className?: string }) => React.ReactElement;

// CIRCLE LINESの共通ボトムナビデザイン「フローティング型のピル型ナビゲーション」。
// 画面下部に左右の余白を設けて浮かせる横長ピル・白系背景・控えめな境界線と影・
// アイコン上/ラベル下、という見た目をここに集約する。
//
// スタッツ入力画面の専用4ボタン(操作バー、PillNavButton)と、Phase 3で刷新した
// 通常画面の下部5タブ(TabBar.tsx、PillNavLink)の両方がこの見た目を共有する。
// サイズ定数(アイコン23px/ラベル9.5px)も両者で共通。

export const PILL_NAV_ICON_CLASS = "w-[23px] h-[23px]";
export const PILL_NAV_LABEL_CLASS = "text-[9.5px] font-bold leading-none whitespace-nowrap";

// TabBar.tsx(通常5タブ)のピル自体の実測高さ。PillNavLinkのpy-2(16px)+アイコン
// バッジ(px-3 py-1、23pxアイコン+py-1×2=8pxで31px)+gap-1(4px)+ラベル
// (text-[9.5px] leading-none、約9.5px)+PillNavBar自体のborder(1px×2=2px)の合計
// (16+31+4+9.5+2=62.5px、安全側に切り上げ)。画面右下の「＋」ボタン(Fab、
// src/components/ui/Modal.tsx)がこのピルと重ならないよう、ピルの上端からの
// 位置を計算する際に使う。ラベル・アイコンサイズを変更した場合はこの値も
// 見直すこと。
export const PILL_NAV_TAB_HEIGHT_PX = 64;

// 画面下部に浮かせる位置の「下端からの余白」の共通計算式。TabBar.tsx(通常5タブ、
// position:fixed)・このPillNavPosition(スタッツ入力画面の専用4ボタン等、
// position:absolute)・Modal.tsxのFab(この値+ピル高さ+間隔)の3箇所が、以前は
// それぞれ別々に同じ式を手書きしていたため、2026-11の実機QAで片方だけを調整した際に
// 3箇所の位置がずれる不具合が発生した。再発防止のためここに一本化し、他はこの定数を
// 参照する。
//
// 実機確認で、下端からの余白がcalc(0.875rem + env(safe-area-inset-bottom))だと
// 離れすぎて見えることが判明した。TabBar.tsx側の過去の調査(ホームインジケーター
// 領域はpadding-bottom等で追加の余白を確保しても見た目の保護領域が増えず、
// 単に余白だけが増える)と同じ理由と考えられるため、固定の余白とsafe-area-inset-bottomを
// 加算せず、大きい方を採用するmax()に変更した。
//
// 2026-11 実機QA第2弾: iPhone Airでmax(0.875rem, env(safe-area-inset-bottom))の
// ままだと下端の余白が大きく見える不具合が再報告された。safe-area-inset-bottomを
// そのまま使う代わりに半分(50%)に縮める。固定のpx/remを差し引く方式(前回の
// 対応)は、実機のsafe-area-inset-bottom自体の実測値が不明なままでは効果量が
// 読めない(値が大きい機種ほど効果が相対的に薄くなる)ため、絶対値ではなく
// 比率で縮める方式に変更した。0.875remのフロアはsafe-area-inset-bottomが
// 小さい/存在しない環境(Android Chrome等、iPad miniのホームボタン機種を含む)
// 向けの最低限の余白として維持する。
//
// 重要な限界: この50%という比率は実機のスクリーンショット実測値から導いた値
// ではなく、往復のフィードバック(「多すぎる」「まだ足りない」)から絞り込んだ
// 推測値である。ホームインジケーターの実際のスワイプ判定領域とどれだけ干渉する
// かはコード上では保証できないため、iPhone Air・他のiPhone・iPad miniの実機で
// 以下を確認すること: (1)ホームインジケーターの上に重なったり操作を誤爆したりし
// ないか、(2)見た目の余白が意図した位置になっているか。不足/過剰であれば、この
// 1箇所(PILL_NAV_BOTTOM_OFFSET)の比率・フロアだけを調整すれば3箇所すべてに
// 反映される。
//
// iPad横画面等、画面幅が広い場合はleft-3/right-3のままだとピルが画面幅いっぱいに
// 伸びてしまう。max-widthを設け、かつleft/right(両方指定)+mx-auto(margin:auto)の
// 組み合わせで、幅がmax-widthを下回る間(iPhone等)は従来通りlef-3/right-3の
// 余白まで伸び、上回る場合(iPad横画面等)はその最大幅のまま中央に固定される。
export const PILL_NAV_BOTTOM_OFFSET = "max(0.875rem, calc(env(safe-area-inset-bottom) * 0.5))";

export function PillNavPosition({ children }: { children: ReactNode }) {
  return (
    <div
      className="absolute left-3 right-3 z-10 mx-auto max-w-[480px]"
      style={{ bottom: PILL_NAV_BOTTOM_OFFSET }}
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

// 通常画面の下部5タブ用のナビリンク。PillNavButton(操作ボタン、常時ハイライトなし)
// とは異なり、選択中のタブだけアイコン背後にピル状のハイライトを常時表示し、
// 非選択タブは控えめな表示にする(確定仕様3)。タブ同士の区切り線は入れない
// (操作ボタン群とは見た目を区別し、連続した1つのタブ群として見せるため)。
export function PillNavLink({
  href,
  icon: Icon,
  label,
  active,
  badge = false,
}: {
  href: string;
  icon: PillNavIcon;
  label: string;
  active: boolean;
  badge?: boolean;
}) {
  return (
    <GuardedLink
      href={href}
      className={`relative flex-1 min-w-0 min-h-tap flex flex-col items-center justify-center gap-1 py-2 ${
        active ? "text-orange-text" : "text-ink-soft"
      }`}
    >
      <span
        className={`relative inline-flex items-center justify-center rounded-full px-3 py-1 ${
          active ? "bg-orange/12" : ""
        }`}
      >
        <Icon className={PILL_NAV_ICON_CLASS} />
        {badge && (
          <span className="absolute top-0 right-0.5 w-[8px] h-[8px] rounded-full bg-danger border border-white" />
        )}
      </span>
      <span className={`${PILL_NAV_LABEL_CLASS} ${active ? "font-bold" : ""}`}>{label}</span>
    </GuardedLink>
  );
}
