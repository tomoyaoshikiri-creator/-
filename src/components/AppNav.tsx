"use client";

import type { Role } from "@/lib/database.types";
import { useSession } from "@/lib/session-context";
import { useTabBadges } from "@/lib/tabBadges";
import { Sidebar } from "@/components/Sidebar";
import { TabBar } from "@/components/TabBar";

// SidebarとTabBarは画面幅によってCSSで出し分けているだけで両方ともDOMに存在するため、
// バッジ判定のクエリをそれぞれで発行すると二重になる。ここで1回だけ計算して両方に渡す。
export function AppNav({ role, children }: { role: Role; children: React.ReactNode }) {
  const { userId, teamId } = useSession();
  const badges = useTabBadges(userId, role, teamId);

  return (
    <>
      <div className="flex-1 flex min-[700px]:flex-row flex-col min-h-0">
        <Sidebar role={role} badges={badges} />
        <div className="flex-1 flex flex-col min-h-0 relative">{children}</div>
      </div>
      <TabBar role={role} badges={badges} />
    </>
  );
}
