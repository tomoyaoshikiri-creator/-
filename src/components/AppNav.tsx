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
  const badges = useTabBadges(userId, teamId);

  return (
    <>
      {/* TabBarはposition:fixedで画面下端に直接固定されており通常のflexレイアウトから
          外れているため、コンテンツ側の最下部がその下に隠れないよう、TabBar自体の高さ
          (pt-2.5+icon17px+gap-0.5+label分、border含め概ね40px)に相当する余白を
          モバイル幅でのみ確保する。デスクトップ幅ではSidebarを使うため不要。 */}
      <div className="flex-1 flex min-[700px]:flex-row flex-col min-h-0 min-[700px]:pb-0 pb-10">
        <Sidebar role={role} badges={badges} />
        <div className="flex-1 flex flex-col min-h-0 relative">{children}</div>
      </div>
      <TabBar role={role} badges={badges} />
    </>
  );
}
