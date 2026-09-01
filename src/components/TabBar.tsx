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
    // 「アイコンを大きくすればSafe Area分の余白が目立たなくなる」という仮説は、
    // 同時に余白自体もenv(safe-area-inset-bottom)全量に増やしてしまったため
    // 検証にならず、実際には「余白が増えた」という結果になり反証された。これまでの
    // フィードバックの中で最も評価が良かった状態(icon17px/label7px、padding-bottomは
    // 理論上の下限0)へ戻す。
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
        const className = `relative flex-1 min-w-0 text-center text-[7px] font-medium flex flex-col items-center gap-0.5 ${
          isLocked ? "text-ink-soft/50" : isActive ? "text-orange font-bold" : "text-ink-soft"
        }`;
        const content = (
          <>
            {/* 視覚サイズを変えずにタップ領域だけを広げる透明ヒットエリア。position:absoluteで
                通常のflexレイアウトから外れるため、TabBar自体の高さには影響しない。 */}
            <span aria-hidden className="absolute -inset-y-[9px] inset-x-0" />
            <span className="relative inline-flex">
              <Icon className="w-[17px] h-[17px]" />
              {isLocked ? (
                <span className="absolute -top-1 -right-1 w-[10px] h-[10px] rounded-full bg-paper border border-line flex items-center justify-center">
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
