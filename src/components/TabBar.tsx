"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/database.types";
import { BOTTOM_NAV_TABS, TAB_LABELS, tabHrefForRole, type TabKey } from "@/lib/permissions";
import { TAB_ICONS } from "@/components/tabIcons";
import { GuardedLink } from "@/components/GuardedLink";

export function TabBar({ role, badges = {} }: { role: Role; badges?: Partial<Record<TabKey, boolean>> }) {
  const pathname = usePathname();
  // .app-shellはoverflow:hiddenのため、その内部にposition:fixedで配置しても、
  // .app-shell自身のボックスが画面の物理的な下端まで届いていない場合はそこで
  // 切り取られてしまう(fixedは「画面のどこに置くか」であって、祖先のoverflow:hidden
  // による切り取りは別問題)。.app-shellのDOM構造の外(document.body直下)に
  // portalで描画することで、.app-shellのボックスサイズ・overflow設定に一切
  // 影響されないようにする。
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const nav = (
    // 「アイコンを大きくすればSafe Area分の余白が目立たなくなる」という仮説は、
    // 同時に余白自体もenv(safe-area-inset-bottom)全量に増やしてしまったため
    // 検証にならず、実際には「余白が増えた」という結果になり反証された。これまでの
    // フィードバックの中で最も評価が良かった状態(icon17px/label7px、padding-bottomは
    // 理論上の下限0)へ戻す。
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

  if (!mounted) return null;
  return createPortal(nav, document.body);
}
