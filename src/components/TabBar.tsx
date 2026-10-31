"use client";

import { usePathname } from "next/navigation";
import type { Role } from "@/lib/database.types";
import { BOTTOM_NAV_TABS, TAB_LABELS, tabHrefForRole, type TabKey } from "@/lib/permissions";
import { TAB_ICONS } from "@/components/tabIcons";
import { PillNavBar, PillNavLink } from "@/components/PillNavBar";
import { useNavExperiment } from "@/lib/navExperiment";

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
// investigation/pr213-nav-safearea-ab(検証用ブランチ)での追加: 実機フィードバックで
// SafariのツールバーとこのTabBarの間に空間が生じる症状が報告されたため、
// useNavExperiment()の navmode=flow で「app-shell(height:100dvh)のflex列内の
// 通常要素として配置する案(B案)」をURLクエリで切り替えて比較できるようにした。
// B案でもピルの浮いた見た目(左右マージン・角丸・影)は維持し、通常の画面下端
// 密着タブバーには戻さない。PR #213本体にはnavMode分岐自体が存在しない。
export function TabBar({ role, badges = {} }: { role: Role; badges?: Partial<Record<TabKey, boolean>> }) {
  const pathname = usePathname();
  const { navMode } = useNavExperiment();

  const pill = (
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
  );

  if (navMode === "flow") {
    // B案(検証用): app-shellのflex列内で実スペースを占有する通常要素。
    // Safariのツールバー展開/収縮でdvhが変化するたびにflexレイアウトの再計算を
    // 通じて追従させる狙い。下端のenv(safe-area-inset-bottom)はこの要素自身の
    // padding-bottomで確保し、ピルはその内側で左右マージン付きで浮かせる。
    return (
      <div className="flex-shrink-0 px-3 pt-2 print:hidden" style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto max-w-[480px]">{pill}</div>
      </div>
    );
  }

  // A案(現行PR #213): ビューポートに対する直接のposition:fixed。
  return (
    <div
      className="fixed left-3 right-3 z-20 mx-auto max-w-[480px] print:hidden"
      style={{ bottom: "max(0.875rem, env(safe-area-inset-bottom))" }}
    >
      {pill}
    </div>
  );
}
