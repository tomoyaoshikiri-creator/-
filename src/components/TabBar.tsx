"use client";

import { usePathname } from "next/navigation";
import type { Role } from "@/lib/database.types";
import { BOTTOM_NAV_TABS, TAB_LABELS, tabHrefForRole, type TabKey } from "@/lib/permissions";
import { TAB_ICONS } from "@/components/tabIcons";
import { GuardedLink } from "@/components/GuardedLink";

export function TabBar({ role, badges = {} }: { role: Role; badges?: Partial<Record<TabKey, boolean>> }) {
  const pathname = usePathname();

  return (
    // ホームインジケーター領域の背景色がbody/.app-shell側から透けて見え、配色改定で
    // 帯として目立つようになったため、TabBar自体の白をSafe Area分(env(safe-area-inset-bottom))
    // まで伸ばす方針に変更した(以前試して「余白が増えた」と反証された組み合わせだが、
    // 今回はSafe Areaの帯を消すこと自体が目的のため許容する)。
    // 併せてアイコン/ラベルも少し拡大(icon17px→19px、label7px→8px)。
    // Safe Area分(約34px)がそのままTabBar全体の高さに上乗せされ、見た目の位置が
    // 以前より高く感じられるとのフィードバックを受け、上側の余白(pt-2.5→pt-1.5)と
    // アイコン-ラベル間のgap(1→0.5)を詰めてSafe Area追加分を部分的に相殺している。
    // ナビ再設計v3でタブ数がロールに関わらず常に5個の固定になったため、8タブ時代の
    // dense(px-3)分岐は不要になった。5タブは旧7タブ時代よりさらに1タブあたりの幅に
    // 余裕があるため、旧non-dense(px-1)側の余白をそのまま使う。
    <nav className="min-[700px]:hidden flex items-start pt-1.5 pb-[env(safe-area-inset-bottom)] px-1 border-t border-line bg-white">
      {BOTTOM_NAV_TABS.map((tab) => {
        const Icon = TAB_ICONS[tab];
        const href = tabHrefForRole(role, tab);
        const isActive = pathname === href || pathname.startsWith(href + "/");
        const className = `relative flex-1 min-w-0 text-center text-[8px] font-medium flex flex-col items-center gap-0.5 ${
          isActive ? "text-orange font-bold" : "text-ink-soft"
        }`;
        return (
          <GuardedLink key={tab} href={href} className={className}>
            {/* 視覚サイズを変えずにタップ領域だけを広げる透明ヒットエリア。position:absoluteで
                通常のflexレイアウトから外れるため、TabBar自体の高さには影響しない。 */}
            <span aria-hidden className="absolute -inset-y-[9px] inset-x-0" />
            <span className="relative inline-flex">
              <Icon className="w-[19px] h-[19px]" />
              {badges[tab] && (
                <span className="absolute -top-0.5 -right-0.5 w-[8px] h-[8px] rounded-full bg-danger border border-white" />
              )}
            </span>
            <span className="whitespace-nowrap leading-none">{TAB_LABELS[tab]}</span>
          </GuardedLink>
        );
      })}
    </nav>
  );
}
