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
      className="px-4.5 pb-4.5"
      style={{
        background: "var(--header-gradient)",
        // Safe Area(ステータスバー領域)もヘッダー背景の一部として扱い、
        // 実コンテンツはその分だけ下へ押し下げる(env()未対応環境では0になり影響しない)。
        paddingTop: "calc(env(safe-area-inset-top) + 1rem)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="flex items-center gap-1.5 min-w-0 rounded-lg pl-1 pr-2 py-1"
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
        className="flex items-center flex-wrap gap-2 font-sans font-bold text-[22px] mt-2.5 mb-1.5 leading-tight break-words tracking-wide"
        style={{ color: "var(--header-title-on)" }}
      >
        {backHref && (
          <GuardedLink
            href={backHref}
            aria-label="戻る"
            className="inline-flex items-center -ml-1 rounded-lg p-0.5"
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
        <div
          className="rounded-[10px] px-3 py-1 flex items-center gap-1.5"
          style={{ background: "var(--header-search-surface)", color: "var(--header-search-on)" }}
        >
          <SearchIcon className="w-3.5 h-3.5 opacity-80 flex-shrink-0" />
          <input
            type="text"
            value={searchValue ?? ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="app-header-search-input flex-1 min-w-0 bg-transparent text-[12.5px] outline-none"
          />
        </div>
      )}
    </div>
  );
}
