"use client";

import type { Role } from "@/lib/database.types";
import { useSession } from "@/lib/session-context";
import { useTabBadges } from "@/lib/tabBadges";
import { useFocusModeState } from "@/lib/focusMode";
import { Sidebar } from "@/components/Sidebar";
import { TabBar } from "@/components/TabBar";

// SidebarとTabBarは画面幅によってCSSで出し分けているだけで両方ともDOMに存在するため、
// バッジ判定のクエリをそれぞれで発行すると二重になる。ここで1回だけ計算して両方に渡す。
export function AppNav({ role, children }: { role: Role; children: React.ReactNode }) {
  const { userId, teamId } = useSession();
  const badges = useTabBadges(userId, teamId, role);
  const { focusMode } = useFocusModeState();

  return (
    <>
      <div className="flex-1 flex min-[700px]:flex-row flex-col min-h-0 print:block">
        {/* min-[700px]:h-fullがないと、このdiv自体はflexの行いっぱいに伸びるが、中のSidebar
            (<nav>)はただのブロック子要素として中身の高さにしかならず、PC/タブレット幅で
            項目数が少ないチームほど下端の背景・境界線・ログアウトが手前で途切れて見えていた。
            700px未満(スマホ幅)では親の行がflex-col(縦積み)に切り替わるため、無条件の
            h-fullだと今度はこのdiv自体がflex-basisとして行の高さをほぼ独占してしまい、
            後続のヘッダー・本文(children側のdiv)が高さ0に押しつぶされて真っ白になる
            不具合を起こした(2026-10-25 発覚・修正)。Sidebar自体がmin-[700px]:flexで
            700px未満は非表示になるのと同じ条件に絞ることで、スマホ幅ではこのdivに
            高さの指定を一切効かせない。 */}
        {/* focusMode(詳細画面などの専用作業画面)では、戻る+ハンバーガーのみにするため
            Sidebar自体を隠す(タブレット幅でのみ出るSidebarの代替導線はヘッダーの
            ハンバーガーメニューが担う)。 */}
        {!focusMode && (
          <div className="print:hidden min-[700px]:h-full">
            <Sidebar role={role} badges={badges} />
          </div>
        )}
        {/* min-w-0がないと、この列は中身(横長の固定列テーブル等)の実寸に合わせて
            幅が広がろうとし、サイドバー常設幅(700px以上)で画面からはみ出た分が
            app-shellのoverflow: hiddenにより見切れていた(iPad mini縦向き等)。 */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 relative print:block">{children}</div>
      </div>
      {!focusMode && (
        <div className="print:hidden">
          <TabBar role={role} badges={badges} />
        </div>
      )}
    </>
  );
}
