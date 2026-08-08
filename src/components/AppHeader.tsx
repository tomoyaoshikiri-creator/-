"use client";

import Link from "next/link";
import { BackIcon, SearchIcon } from "@/components/icons";
import { useSession } from "@/lib/session-context";

export function AppHeader({
  title,
  variant = "list",
  backHref,
  rightSlot,
  searchPlaceholder,
  searchValue,
  onSearchChange,
}: {
  title: string;
  variant?: "list" | "detail";
  backHref?: string;
  rightSlot?: React.ReactNode;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}) {
  const { teamName, teamLogoUrl } = useSession();
  const bg = variant === "detail" ? "bg-navy" : "bg-orange";
  return (
    <div className={`${bg} text-white px-4.5 pt-4 pb-4.5`}>
      <div className="flex items-center justify-between">
        {backHref ? (
          <Link href={backHref} aria-label="戻る" className="opacity-95">
            <BackIcon className="w-5 h-5" />
          </Link>
        ) : (
          <span className="flex items-center gap-1.5">
            {teamLogoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={teamLogoUrl} alt="" className="w-6 h-6 rounded object-contain bg-white/20" />
            )}
            <span className="font-mono text-[15.5px] tracking-widest uppercase opacity-80">
              {teamName}
            </span>
          </span>
        )}
        {rightSlot}
      </div>
      <h1 className="font-sans font-medium text-[26px] mt-2.5 mb-3 leading-tight break-words tracking-wide">
        {title}
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
