"use client";

import { BackIcon, SearchIcon } from "@/components/icons";
import { useSession } from "@/lib/session-context";
import { CurrentUserBadge } from "@/components/CurrentUserBadge";
import { GuardedLink } from "@/components/GuardedLink";

export function AppHeader({
  title,
  variant = "list",
  backHref,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  accessBadge,
}: {
  title: string;
  // Phase UI-2B以降、背景は常にCIRCLE LINESブランドグラデーション01/チーム版01(--header-gradient)
  // に統一したため、variantは背景色の出し分けには使わなくなった。呼び出し元(既存約35箇所)を
  // 変更せずに済むよう、propsとしては維持している。
  variant?: "list" | "detail";
  backHref?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  // このページに実際にアクセスできるロールを画面上で明示するための任意バッジ。
  // "coach"は指導者・管理者専用画面、"admin"は管理者専用画面であることを示す。
  accessBadge?: "coach" | "admin";
}) {
  void variant;
  const { teamName, teamLogoUrl } = useSession();
  return (
    <div
      className="px-4.5 pb-3.5"
      style={{
        background: "var(--header-gradient)",
        // Safe Area(ステータスバー領域)もヘッダー背景の一部として扱い、実コンテンツは
        // その分だけ下へ押し下げる(env()未対応環境では0になり影響しない)。viewport-fit=cover
        // 導入前はステータスバー領域がOS管理でHeaderの一部ではなかったため、実機上の視覚占有量が
        // その分そのまま増える。完全には相殺できないため、以下のcontent側の余白(この
        // paddingTopの装飾分・行間・下部padding)を必要最小限まで詰め、Safe Area込みの
        // 総占有量をできるだけ改修前に近づける。
        paddingTop: "calc(env(safe-area-inset-top) + 0.625rem)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          // Phase UI-2B以前はpaddingなしの素のspanだった。半透明surfaceの背景を見せるため
          // 横方向のpaddingは維持しつつ、縦方向(py)は付けない(付けるとHeader全体の
          // 縦占有サイズが改修前より増えてしまうため、行の高さは中身のアイコン/文字の
          // 自然な高さに委ねる)。
          className="flex items-center gap-1.5 min-w-0 rounded-lg pl-1 pr-2"
          style={{ background: "var(--header-chip-surface)", color: "var(--header-chip-on)" }}
        >
          {teamLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={teamLogoUrl} alt="" className="w-6 h-6 rounded object-contain flex-shrink-0" />
          )}
          <span className="font-mono text-[15.5px] tracking-widest uppercase opacity-85 truncate">{teamName}</span>
        </span>
        <CurrentUserBadge />
      </div>
      <h1
        // Safe Area込みの総占有量を改修前へ近づけるため、row gap(mt/mb)を必要最小限に
        // 詰めている(mt-2.5→mt-1.5、mb-1.5→mb-1)。文字サイズ・leading-tight(行間)・
        // タップ領域は変更していない。
        className="flex items-center flex-wrap gap-2 font-sans font-bold text-[22px] mt-1.5 mb-1 leading-tight break-words tracking-wide"
        style={{ color: "var(--header-title-on)" }}
      >
        {backHref && (
          <GuardedLink
            href={backHref}
            aria-label="戻る"
            // Phase UI-2B以前はpaddingなし(-ml-1のみ)だった。p-0.5を付けると、通常
            // (--header-title-surfaceがtransparentの)ケースでも見た目上は変化しないが、
            // アイコン自体のbox(24px)がtext-[22px] leading-tightの行高(約27.5px)を
            // 上回りかねず、h1行の高さがHeader全体の縦占有サイズを押し上げてしまう
            // ため付けない(rounded-lg+背景色自体は、コントラスト救済で
            // surfaceが表示される稀なケースのために維持する)。
            className="inline-flex items-center -ml-1 rounded-lg"
            style={{ background: "var(--header-title-surface)" }}
          >
            <BackIcon className="w-6 h-6" />
          </GuardedLink>
        )}
        <span className="rounded px-0.5" style={{ background: "var(--header-title-surface)" }}>
          {title}
        </span>
        {accessBadge && (
          <span
            className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md tracking-wide"
            style={{ background: "var(--header-chip-surface)", color: "var(--header-chip-on)" }}
          >
            {accessBadge === "admin" ? "管理者専用画面" : "コーチ専用画面"}
          </span>
        )}
      </h1>
      {searchPlaceholder && (
        // 検索欄を約2/3の厚みへ縮小。文字サイズはglobals.cssのiOSズーム防止ルール
        // (input,select,textarea{font-size:16px !important})によりCSS側から16px未満に
        // できないため、縮小はpadding-y/gap/アイコンサイズのみで行う。line-height:1にしても
        // <input>要素自体の内在サイズ(約18px、フォント上下メトリクス由来)はこれ以上
        // 縮まらないため、これが縦方向の実質的な下限。py-0まで詰めても16px入力+約2pxの
        // 内在余白で約18pxとなり、圧縮前(約26px)の約69%(≒2/3)。
        <div
          className="rounded-[9px] px-3 py-0 flex items-center gap-1"
          style={{ background: "var(--header-search-surface)", color: "var(--header-search-on)" }}
        >
          <SearchIcon className="w-3 h-3 opacity-80 flex-shrink-0" />
          <input
            type="text"
            value={searchValue ?? ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="app-header-search-input flex-1 min-w-0 bg-transparent text-[12.5px] leading-none outline-none"
          />
        </div>
      )}
    </div>
  );
}
