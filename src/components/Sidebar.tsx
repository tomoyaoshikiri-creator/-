"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/database.types";
import { TAB_LABELS, TAB_PATHS, tabsForRole } from "@/lib/permissions";
import { TAB_ICONS } from "@/components/tabIcons";
import { useSession } from "@/lib/session-context";

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const { teamName, teamLogoUrl } = useSession();
  const tabs = tabsForRole(role);

  return (
    <nav className="hidden md:flex flex-col w-[220px] flex-shrink-0 border-r border-line bg-white px-3 py-5">
      <div className="flex items-center gap-2 px-2 mb-6">
        {teamLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={teamLogoUrl} alt="" className="w-7 h-7 rounded object-contain bg-paper flex-shrink-0" />
        )}
        <span className="font-display font-bold text-[15px] text-ink truncate">{teamName}</span>
      </div>

      <div className="flex flex-col gap-0.5">
        {tabs.map((tab) => {
          const Icon = TAB_ICONS[tab];
          const href = TAB_PATHS[tab];
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={tab}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[13px] font-bold ${
                isActive ? "bg-orange/10 text-orange" : "text-ink-soft"
              }`}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {TAB_LABELS[tab]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
