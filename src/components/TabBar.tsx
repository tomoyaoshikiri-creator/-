"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/database.types";
import { TAB_LABELS, TAB_PATHS, tabsForRole, type TabKey } from "@/lib/permissions";
import {
  GameIcon,
  NoticeIcon,
  NotesIcon,
  PlayersIcon,
  ReportIcon,
  ScheduleIcon,
  UsersIcon,
} from "@/components/icons";

const TAB_ICONS: Record<TabKey, (props: { className?: string }) => React.ReactElement> = {
  schedule: ScheduleIcon,
  notice: NoticeIcon,
  report: ReportIcon,
  players: PlayersIcon,
  notes: NotesIcon,
  game: GameIcon,
  users: UsersIcon,
};

export function TabBar({ role }: { role: Role }) {
  const pathname = usePathname();
  const tabs = tabsForRole(role);

  return (
    <nav className="flex items-start px-1 pt-2.5 pb-3.5 border-t border-line bg-white">
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab];
        const href = TAB_PATHS[tab];
        const isActive = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={tab}
            href={href}
            className={`flex-1 min-w-0 text-center text-[9px] font-medium flex flex-col items-center gap-0.5 ${
              isActive ? "text-orange font-bold" : "text-ink-soft"
            }`}
          >
            <Icon className="w-[19px] h-[19px]" />
            {TAB_LABELS[tab]}
          </Link>
        );
      })}
    </nav>
  );
}
