"use client";

import { usePathname } from "next/navigation";
import type { Role } from "@/lib/database.types";
import { TAB_LABELS, tabHrefForRole, tabsForRole, type TabKey } from "@/lib/permissions";
import { TAB_ICONS } from "@/components/tabIcons";
import { LockIcon } from "@/components/icons";
import { useSession } from "@/lib/session-context";
import { useUpgradePrompt } from "@/components/PlanLock";
import { hasCoachNoteAccess } from "@/lib/plan";
import { GuardedLink } from "@/components/GuardedLink";

export function Sidebar({ role, badges = {} }: { role: Role; badges?: Partial<Record<TabKey, boolean>> }) {
  const pathname = usePathname();
  const { teamName, teamLogoUrl, plan } = useSession();
  const promptUpgrade = useUpgradePrompt();
  const tabs = tabsForRole(role);
  const locked: Partial<Record<TabKey, boolean>> = { coachNote: !hasCoachNoteAccess(plan) };

  return (
    <nav className="hidden min-[700px]:flex flex-col w-[145px] flex-shrink-0 border-r border-line bg-white px-2 py-5">
      <div className="flex items-center gap-1.5 px-1.5 mb-6">
        {teamLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={teamLogoUrl} alt="" className="w-6 h-6 rounded object-contain bg-paper flex-shrink-0" />
        )}
        <span className="font-display font-bold text-[13px] text-ink truncate">{teamName}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {tabs.map((tab) => {
          const Icon = TAB_ICONS[tab];
          const href = tabHrefForRole(role, tab);
          const isActive = pathname === href || pathname.startsWith(href + "/");
          const isLocked = locked[tab];
          const className = `flex items-center gap-2 px-2.5 py-3.5 rounded-[10px] text-[12px] font-bold ${
            isLocked ? "text-ink-soft/50" : isActive ? "bg-orange/10 text-orange" : "text-ink-soft"
          }`;
          const content = (
            <>
              <span className="relative inline-flex flex-shrink-0">
                <Icon className="w-4 h-4" />
                {isLocked ? (
                  <span className="absolute -top-1 -right-1 w-[10px] h-[10px] rounded-full bg-paper border border-line flex items-center justify-center">
                    <LockIcon className="w-[6px] h-[6px] text-ink-soft" />
                  </span>
                ) : (
                  badges[tab] && (
                    <span className="absolute -top-0.5 -right-0.5 w-[6px] h-[6px] rounded-full bg-danger border border-white" />
                  )
                )}
              </span>
              {TAB_LABELS[tab]}
            </>
          );
          if (isLocked) {
            return (
              <button
                key={tab}
                type="button"
                onClick={() => promptUpgrade(`${TAB_LABELS[tab]}は上位プランで利用できます`)}
                className={className}
              >
                {content}
              </button>
            );
          }
          return (
            <GuardedLink key={tab} href={href} className={className}>
              {content}
            </GuardedLink>
          );
        })}
      </div>
    </nav>
  );
}
