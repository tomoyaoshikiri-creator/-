"use client";

import Link from "next/link";
import { BackIcon, SearchIcon } from "@/components/icons";
import { useSession } from "@/lib/session-context";
import { CurrentUserBadge } from "@/components/CurrentUserBadge";

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
  variant?: "list" | "detail";
  backHref?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  // このページに実際にアクセスできるロールを画面上で明示するための任意バッジ。
  // "coach"は指導者・管理者専用画面、"admin"は管理者専用画面であることを示す。
  accessBadge?: "coach" | "admin";
}) {
  const { teamName, teamLogoUrl } = useSession();
  const bg = variant === "detail" ? "bg-navy" : "bg-orange";
  return (
    <div className={`${bg} text-white px-4.5 pt-4 pb-4.5`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 min-w-0">
          {backHref && (
            <Link href={backHref} aria-label="戻る" className="opacity-95 flex-shrink-0">
              <BackIcon className="w-5 h-5" />
            </Link>
          )}
          {teamLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={teamLogoUrl} alt="" className="w-6 h-6 rounded object-contain bg-white/20 flex-shrink-0" />
          )}
          <span className="font-mono text-[15.5px] tracking-widest uppercase opacity-80 truncate">
            {teamName}
          </span>
        </span>
        <CurrentUserBadge />
      </div>
      <h1 className="flex items-center flex-wrap gap-2 font-sans font-medium text-[26px] mt-2.5 mb-3 leading-tight break-words tracking-wide">
        {title}
        {accessBadge && (
          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/20 tracking-wide">
            {accessBadge === "admin" ? "管理者専用画面" : "コーチ専用画面"}
          </span>
        )}
      </h1>
      {searchPlaceholder && (
        <div className="bg-white/22 rounded-[10px] px-3 py-1 flex items-center gap-1.5">
          <SearchIcon className="w-3.5 h-3.5 opacity-80 flex-shrink-0" />
          <input
            type="text"
            value={searchValue ?? ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 min-w-0 bg-transparent text-[12.5px] text-white placeholder-white/70 outline-none"
          />
        </div>
      )}
    </div>
  );
}
