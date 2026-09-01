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
    // 【比較検証用】viewport-fit=coverを維持したままpadding-bottomは理論上の下限(0)。
    // それでも「まだ余白がある」場合の最後の手段として、icon(19px→15px)・
    // label(7.5px→6.5px)・バッジ類を控えめに縮小する。タップ領域は
    // -inset-y-[10px]に広げて44px相当を維持する。
    <nav
      className={`min-[700px]:hidden flex items-start pt-2.5 pb-0 border-t border-line bg-white ${
        dense ? "px-3" : "px-1"
      }`}
    >
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab];
        const href = tabHrefForRole(role, tab);
        const isActive = pathname === href || pathname.startsWith(href + "/");
        const isLocked = locked[tab];
        const className = `relative flex-1 min-w-0 text-center text-[6.5px] font-medium flex flex-col items-center gap-0.5 ${
          isLocked ? "text-ink-soft/50" : isActive ? "text-orange font-bold" : "text-ink-soft"
        }`;
        const content = (
          <>
            {/* 視覚サイズを変えずにタップ領域だけを広げる透明ヒットエリア。position:absoluteで
                通常のflexレイアウトから外れるため、TabBar自体の高さには影響しない。 */}
            <span aria-hidden className="absolute -inset-y-[10px] inset-x-0" />
            <span className="relative inline-flex">
              <Icon className="w-[15px] h-[15px]" />
              {isLocked ? (
                <span className="absolute -top-1 -right-1 w-[9px] h-[9px] rounded-full bg-paper border border-line flex items-center justify-center">
                  <LockIcon className="w-[6px] h-[6px] text-ink-soft" />
                </span>
              ) : (
                badges[tab] && (
                  <span className="absolute -top-0.5 -right-0.5 w-[8px] h-[8px] rounded-full bg-danger border border-white" />
                )
              )}
            </span>
            <span className="whitespace-nowrap leading-none">{TAB_LABELS[tab]}</span>
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
