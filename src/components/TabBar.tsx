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
    // Phase UI-2B: 「3/5」という指示の対象はicon/label自体の縮尺ではなく、Navigation
    // contentの上下にある空白だったと確定した。icon(19px)・gap(2px)・label(通常の
    // 行高)・lock badge/notification dotのサイズは5861e67時点(直前の縮小より前)へ
    // 完全に戻し、縮めるのはpadding-top/padding-bottomという「余白」だけにする。
    // icon+gap+labelという中身だけで既に約31px(実測)を占めており、これ以上は
    // icon/labelを縮めない限り縮小できないため、padding-topは実質0まで、
    // padding-bottomはHome Indicatorとの干渉を避けられる範囲で詰められる下限
    // (env(safe-area-inset-bottom)の20%相当、実機で約7px)まで圧縮している。
    <nav
      className={`min-[700px]:hidden flex items-start border-t border-line bg-white ${
        dense ? "px-3" : "px-1"
      }`}
      style={{ paddingBottom: "clamp(0.375rem, calc(env(safe-area-inset-bottom) * 0.2), 0.5rem)" }}
    >
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab];
        const href = tabHrefForRole(role, tab);
        const isActive = pathname === href || pathname.startsWith(href + "/");
        const isLocked = locked[tab];
        const className = `relative flex-1 min-w-0 text-center text-[7.5px] font-medium flex flex-col items-center gap-0.5 ${
          isLocked ? "text-ink-soft/50" : isActive ? "text-orange font-bold" : "text-ink-soft"
        }`;
        const content = (
          <>
            {/* 視覚サイズを変えずにタップ領域だけを広げる透明ヒットエリア。position:absoluteで
                通常のflexレイアウトから外れるため、TabBar自体の高さには影響しない
                (親要素<nav>・<button>/<a>本体にoverflow指定がないため、この範囲まで正しく
                タップを拾える)。visual contentは変えず、44px相当の操作性を確保する。 */}
            <span aria-hidden className="absolute -inset-y-[7px] inset-x-0" />
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
