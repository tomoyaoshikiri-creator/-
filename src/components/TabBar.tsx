"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/database.types";
import { TAB_LABELS, TAB_PATHS, tabsForRole } from "@/lib/permissions";
import { TAB_ICONS } from "@/components/tabIcons";

export function TabBar({ role }: { role: Role }) {
  const pathname = usePathname();
  const tabs = tabsForRole(role);
  // 管理者はタブ数が8個と最も多く、フルディスプレイのiPhoneでは端の項目が
  // 画面の丸みや安全域ぎりぎりに寄ってしまうため、左右の余白を少し多めに取って内側に寄せる。
  const dense = tabs.length >= 8;

  return (
    <nav
      className={`min-[700px]:hidden flex items-start pt-2.5 pb-6.5 border-t border-line bg-white ${
        dense ? "px-3" : "px-1"
      }`}
    >
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab];
        const href = TAB_PATHS[tab];
        const isActive = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={tab}
            href={href}
            className={`flex-1 min-w-0 text-center text-[9px] font-medium flex flex-col items-center gap-0.5 ${
              isActive ? "text-orange font-bold" : "text-ink-soft"
            }`}
          >
            <Icon className="w-[19px] h-[19px]" />
            {TAB_LABELS[tab]}
          </Link>
        );
      })}
    </nav>
  );
}
