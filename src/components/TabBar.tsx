"use client";

import { usePathname } from "next/navigation";
import type { Role } from "@/lib/database.types";
import { TAB_LABELS, tabHrefForRole, tabsForRole, type TabKey } from "@/lib/permissions";
import { TAB_ICONS } from "@/components/tabIcons";
import { LockIcon } from "@/components/icons";
import { GuardedLink } from "@/components/GuardedLink";
import { useSession } from "@/lib/session-context";
import { useUpgradePrompt } from "@/components/PlanLock";
import { hasCoachNoteAccess } from "@/lib/plan";

export function TabBar({ role, badges = {} }: { role: Role; badges?: Partial<Record<TabKey, boolean>> }) {
  const pathname = usePathname();
  const { plan } = useSession();
  const promptUpgrade = useUpgradePrompt();
  const tabs = tabsForRole(role);
  // 管理者はタブ数が8個と最も多く、フルディスプレイのiPhoneでは端の項目が
  // 画面の丸みや安全域ぎりぎりに寄ってしまうため、左右の余白を少し多めに取って内側に寄せる。
  const dense = tabs.length >= 8;
  // プラン不足で使えないタブはグレーアウト+鍵アイコンにし、タップで案内する
  // (完全に隠すと機能の存在に気づけないため)。
  const locked: Partial<Record<TabKey, boolean>> = { coachNote: !hasCoachNoteAccess(plan) };

  return (
    // Phase UI-2B: 3ca9e71の30px(pb-7.5)という固定値を基準にはしない。ホームインジケータへの
    // 物理的な干渉を防ぐために本当に必要なのはenv(safe-area-inset-bottom)分の余白だけであり、
    // 「Safe Areaだから大きく確保する」という考え方はとらない。padding-topも装飾目的の
    // 最小限(pt-1)まで詰め、icon(19px)・gap(2px)・label自体のサイズは変更しない。
    // padding-bottomは、Safe Areaがない環境向けの最小フォールバック(0.75rem)と
    // env(safe-area-inset-bottom)の大きい方を採用し、実機(env=34px前後)ではenv()の値が
    // そのままそのまま採用される(0.75remは実質env非対応環境専用)。
    <nav
      className={`min-[700px]:hidden flex items-start pt-1 border-t border-line bg-white ${
        dense ? "px-3" : "px-1"
      }`}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab];
        const href = tabHrefForRole(role, tab);
        const isActive = pathname === href || pathname.startsWith(href + "/");
        const isLocked = locked[tab];
        const className = `flex-1 min-w-0 text-center text-[7.5px] font-medium flex flex-col items-center gap-0.5 ${
          isLocked ? "text-ink-soft/50" : isActive ? "text-orange font-bold" : "text-ink-soft"
        }`;
        const content = (
          <>
            <span className="relative inline-flex">
              <Icon className="w-[19px] h-[19px]" />
              {isLocked ? (
                <span className="absolute -top-1 -right-1 w-[11px] h-[11px] rounded-full bg-paper border border-line flex items-center justify-center">
                  <LockIcon className="w-[7px] h-[7px] text-ink-soft" />
                </span>
              ) : (
                badges[tab] && (
                  <span className="absolute -top-0.5 -right-0.5 w-[9px] h-[9px] rounded-full bg-danger border border-white" />
                )
              )}
            </span>
            <span className="whitespace-nowrap">{TAB_LABELS[tab]}</span>
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
    </nav>
  );
}
