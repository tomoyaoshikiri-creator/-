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
  const badges = useTabBadges(userId, teamId, role);

  return (
    <>
      <div className="flex-1 flex min-[700px]:flex-row flex-col min-h-0 print:block">
        {/* h-fullがないと、このdiv自体はflexの行いっぱいに伸びるが、中のSidebar
            (<nav>)はただのブロック子要素として中身の高さにしかならず、PC/タブレット幅で
            項目数が少ないチームほど下端の背景・境界線・ログアウトが手前で途切れて見えていた。 */}
        <div className="print:hidden h-full">
          <Sidebar role={role} badges={badges} />
        </div>
        {/* min-w-0がないと、この列は中身(横長の固定列テーブル等)の実寸に合わせて
            幅が広がろうとし、サイドバー常設幅(700px以上)で画面からはみ出た分が
            app-shellのoverflow: hiddenにより見切れていた(iPad mini縦向き等)。 */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 relative print:block">{children}</div>
      </div>
      <div className="print:hidden">
        <TabBar role={role} badges={badges} />
      </div>
    </>
  );
}
