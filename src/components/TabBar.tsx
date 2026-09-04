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
    // ホームインジケーター領域に色違いの帯が見える問題は、safe-area分を白で
    // 塗り足す対症療法(padding-bottom拡張・position:absoluteの塗りつぶし要素)を
    // 何度試しても解消しなかった。.app-shell(position:fixed; inset:0)の下端が、
    // standaloneモードのiOSで物理的な画面下端まで正しく到達していない疑いが強いため、
    // TabBar自体をnavの通常のflexレイアウトから外し、position:fixedで画面(viewport)の
    // 物理的な下端に直接固定する方式に変更した。.app-shellの内部計算に依存しないため、
    // 確実に画面の一番下に来る。コンテンツ側の余白はAppNav.tsx側で確保している。
    // ナビ再設計v3でタブ数がロールに関わらず常に5個の固定になったため、8タブ時代の
    // dense(px-3)分岐は不要になった。5タブは旧7タブ時代よりさらに1タブあたりの幅に
    // 余裕があるため、旧non-dense(px-1)側の余白をそのまま使う。
    <nav className="min-[700px]:hidden fixed inset-x-0 bottom-0 flex items-start pt-2.5 pb-0 px-1 border-t border-line bg-white">
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
