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
    // 理論上の下限0)へ戻す。アイコン/ラベル自体の画面上の位置はこれで変更前と同じになる。
    //
    // ホームインジケーター領域の背景色がbody/.app-shell側から透けて見える問題は、
    // TabBar自体の高さ(padding-bottom)を増やすのではなく、position:absoluteで
    // レイアウトの高さ計算から外した塗りつぶし用の要素(下記fillSafeArea)を
    // nav の直後に重ねる形で解消する。この要素は通常のflexレイアウトに参加しないため、
    // アイコン/ラベルの位置・TabBar自体の高さには一切影響しない。
    // ナビ再設計v3でタブ数がロールに関わらず常に5個の固定になったため、8タブ時代の
    // dense(px-3)分岐は不要になった。5タブは旧7タブ時代よりさらに1タブあたりの幅に
    // 余裕があるため、旧non-dense(px-1)側の余白をそのまま使う。
    <nav className="min-[700px]:hidden relative flex items-start pt-2.5 pb-0 px-1 border-t border-line bg-white">
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
      {/* ホームインジケーター分の帯を白で塗りつぶす。position:absoluteのためnav自体の
          高さ(flexレイアウト)には加算されず、アイコン/ラベルの位置は変わらない。 */}
      <span aria-hidden className="absolute inset-x-0 top-full h-[env(safe-area-inset-bottom)] bg-white" />
    </nav>
  );
}
