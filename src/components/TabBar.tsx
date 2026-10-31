"use client";

import { usePathname } from "next/navigation";
import type { Role } from "@/lib/database.types";
import { BOTTOM_NAV_TABS, TAB_LABELS, tabHrefForRole, type TabKey } from "@/lib/permissions";
import { TAB_ICONS } from "@/components/tabIcons";
import { PillNavBar, PillNavLink } from "@/components/PillNavBar";

// Phase 3: 通常画面の下部5タブをフローティング型のピル型ナビゲーションに統一した
// (PillNavBar.tsx参照、スタッツ入力画面の専用操作バーと見た目の構成要素を共有)。
// 常時表示のSidebar(タブレット幅以上)は廃止したため、iPhone・iPadの縦横すべてで
// このTabBarがボトムナビとして表示される。
//
// PillNavPositionは「ページごとのcontent wrapper(position:relative)」を前提に
// 位置決めしており、PageShellのfabスロット経由でページ単位に使うものだったため、
// AppNavレベルで全画面共通に1回だけ描画するこのTabBarにはそのまま使えない
// (DOM上の位置決めの基準が異なる)。そのためposition:fixedを直接ここで使い、
// ビューポート基準でapp-shell(position:fixed; margin:0 auto; max-width:480px)と
// 同じ中央寄せ(left:0/right:0 + margin:auto + max-width)を独自に行っている。
export function TabBar({ role, badges = {} }: { role: Role; badges?: Partial<Record<TabKey, boolean>> }) {
  const pathname = usePathname();

  return (
    <div
      className="fixed left-3 right-3 z-20 mx-auto max-w-[480px] print:hidden"
      style={{ bottom: "max(0.875rem, env(safe-area-inset-bottom))" }}
    >
      <PillNavBar>
        {BOTTOM_NAV_TABS.map((tab) => {
          const href = tabHrefForRole(role, tab);
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <PillNavLink
              key={tab}
              href={href}
              icon={TAB_ICONS[tab]}
              label={TAB_LABELS[tab]}
              active={isActive}
              badge={badges[tab]}
            />
          );
        })}
      </PillNavBar>
    </div>
  );
}
