"use client";

import { usePathname } from "next/navigation";
import type { Role } from "@/lib/database.types";
import { BOTTOM_NAV_TABS, TAB_LABELS, tabHrefForRole, type TabKey } from "@/lib/permissions";
import { TAB_ICONS } from "@/components/tabIcons";
import { GuardedLink } from "@/components/GuardedLink";

export function TabBar({ role, badges = {} }: { role: Role; badges?: Partial<Record<TabKey, boolean>> }) {
  const pathname = usePathname();

  return (
    // 「アイコンを大きくすればSafe Area分の余白が目立たなくなる」という仮説は、
    // 同時に余白自体もenv(safe-area-inset-bottom)全量に増やしてしまったため
    // 検証にならず、実際には「余白が増えた」という結果になり反証された。これまでの
    // フィードバックの中で最も評価が良かった状態(icon17px/label7px、padding-bottomは
    // 理論上の下限0)へ戻す。
    //
    // ホームインジケーター領域に色違いの帯が見える問題は、padding拡張・
    // position:fixed・document.bodyへのportal描画など複数の方式を実機の
    // ピクセル解析付きで検証したが、いずれも全く同じ位置(画面物理下端の
    // 約68pt手前)で描画が止まることが確認された。position:fixed+portalという
    // 本来この制約から逃れられるはずの組み合わせでも同じ結果になったことから、
    // これはページ側のCSS/DOM構造では制御できない、iOS側が予約している領域で
    // ある可能性が高いと判断した。そのためTabBar自体の位置・高さを変える対策は
    // やめ、その領域の色を左右する可能性が高いmanifest.tsのbackground_colorを
    // --paperに合わせる対応に変更した(TabBar自体の背景も同じ--paperにして
    // 二重に色を揃えている)。
    // ナビ再設計v3でタブ数がロールに関わらず常に5個の固定になったため、8タブ時代の
    // dense(px-3)分岐は不要になった。5タブは旧7タブ時代よりさらに1タブあたりの幅に
    // 余裕があるため、旧non-dense(px-1)側の余白をそのまま使う。
    <nav className="min-[700px]:hidden flex items-start pt-2.5 pb-0 px-1 border-t border-line bg-paper">
      {BOTTOM_NAV_TABS.map((tab) => {
        const Icon = TAB_ICONS[tab];
        const href = tabHrefForRole(role, tab);
        const isActive = pathname === href || pathname.startsWith(href + "/");
        const className = `relative flex-1 min-w-0 text-center text-[7px] font-medium flex flex-col items-center gap-0.5 ${
          isActive ? "text-orange font-bold" : "text-ink-soft"
        }`;
        return (
          <GuardedLink key={tab} href={href} className={className}>
            {/* 視覚サイズを変えずにタップ領域だけを広げる透明ヒットエリア。position:absoluteで
                通常のflexレイアウトから外れるため、TabBar自体の高さには影響しない。 */}
            <span aria-hidden className="absolute -inset-y-[9px] inset-x-0" />
            <span className="relative inline-flex">
              <Icon className="w-[17px] h-[17px]" />
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
