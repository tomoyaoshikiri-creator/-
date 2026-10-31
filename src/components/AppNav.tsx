"use client";

import type { Role } from "@/lib/database.types";
import { useSession } from "@/lib/session-context";
import { useTabBadges } from "@/lib/tabBadges";
import { useFocusModeState } from "@/lib/focusMode";
import { TabBar } from "@/components/TabBar";
import { useNavExperiment } from "@/lib/navExperiment";
import { SafeAreaDebugOverlay } from "@/components/SafeAreaDebugOverlay";

// Phase 3(共通ナビゲーション刷新)で、タブレット幅以上の常時表示サイドバー
// (旧Sidebar.tsx)を廃止した。iPhone・iPadの縦横を問わず、ナビゲーションは
// 下部のTabBar(ピル型)+ヘッダーのハンバーガー(NavDrawer)に一本化している。
// サイドバーが無くなったため、幅による行(flex-row)/列(flex-col)の出し分けも
// 不要になり、childrenをそのまま縦に流すだけのシンプルな構造になった。
export function AppNav({ role, children }: { role: Role; children: React.ReactNode }) {
  const { userId, teamId } = useSession();
  const badges = useTabBadges(userId, teamId, role);
  // スタッツ入力画面・スケジュール詳細画面等の「専用作業画面」がuseFocusMode(true)を
  // 呼んでいる間だけ、通常の下部TabBarを非表示にする(画面側は戻る+ハンバーガーや
  // 専用操作バーに置き換える)。
  const { focusMode } = useFocusModeState();
  // investigation/pr213-nav-safearea-ab(検証用ブランチ)での追加: ?debug=1の時だけ
  // Safe Area診断オーバーレイを表示する。PR #213本体にはこの分岐は存在しない。
  const { debug } = useNavExperiment();

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative print:block">{children}</div>
      {!focusMode && <TabBar role={role} badges={badges} />}
      {debug && <SafeAreaDebugOverlay />}
    </>
  );
}
