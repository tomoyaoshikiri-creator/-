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
//
// 2026-11 実機QA第1弾: iPhone Airの実機確認で、下部メニューの位置が高すぎて
// 下側に余白が残ることが判明した。以前(PillNavBar.tsx参照)、固定の余白と
// safe-area-inset-bottomを単純に加算するとホームインジケーター領域の上に
// さらに余白が二重に乗ってしまう問題をmax()で解消した経緯があるが、
// safe-area-inset-bottomが大きい端末ではmax()の結果がその値そのものになり、
// 本来のホームインジケーター保護領域に対してさらに0.875rem分のゆとりが
// 必要という前提(元のmax()導入時の基準)が、結果的に安全マージンを
// 二重に確保する形になっていた。ここでは、safe-area-inset-bottomから
// その0.875rem分を差し引くことで、ホームインジケーター保護領域そのものは
// 侵食せずに(0.875remはどの機種でも通常のホームインジケーター領域幅より
// 小さい)、必要以上の余白だけを削る。safe-area-inset-bottomが0.875rem
// 未満の機種(iPad mini等、ホームインジケーターの概念がない機種を含む)では
// 従来通りmax()の0.875rem側が効き、挙動は変わらない。
export function TabBar({ role, badges = {} }: { role: Role; badges?: Partial<Record<TabKey, boolean>> }) {
  const pathname = usePathname();

  return (
    <div
      className="fixed left-3 right-3 z-20 mx-auto max-w-[480px] print:hidden"
      style={{ bottom: "max(0.875rem, calc(env(safe-area-inset-bottom) - 0.875rem))" }}
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
