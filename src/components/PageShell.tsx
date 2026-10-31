"use client";

import { useFocusModeState } from "@/lib/focusMode";
import { useNavExperiment } from "@/lib/navExperiment";

// Phase 3で下部ナビをフローティング型のピルに変更したため(TabBar.tsx)、
// 通常画面(focusMode=false)ではコンテンツ最下部がピルの裏に隠れないよう、
// 共通レイアウト側でこのスクロール領域に十分な下部余白を確保する。
// 専用作業画面(focusMode=true、スタッツ入力画面・スケジュール詳細画面)は
// 画面側で既に専用操作バー分の余白を個別に用意しているため、ここでは
// 従来通りの余白(pb-5)のまま変更しない(二重に余白が付くのを防ぐため)。
//
// investigation/pr213-nav-safearea-ab(検証用ブランチ)での追加: navmode=flow
// (TabBar.tsxのB案、app-shellのflex列内で実スペースを占有する配置)では
// TabBar自身がレイアウト上の実スペースを取るため、position:fixed前提のpb-28
// (ピルの裏に隠れないための余白)は不要かつ二重に余白が付く原因になる。
// そのためnavMode === "flow"の時だけ通常の余白(pb-4)に切り替える。
// PR #213本体にはこのnavMode分岐は存在しない。
export function PageShell({
  header,
  children,
  fab,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  fab?: React.ReactNode;
}) {
  const { focusMode } = useFocusModeState();
  const { navMode } = useNavExperiment();
  const bottomPadding = focusMode ? "pb-5" : navMode === "flow" ? "pb-4" : "pb-28";
  return (
    <>
      <div className="print:hidden">{header}</div>
      <div
        className={`flex-1 overflow-y-auto px-4.5 pt-4 ${bottomPadding} relative min-[700px]:px-8 min-[700px]:pt-6 print:overflow-visible print:p-0`}
      >
        {children}
      </div>
      <div className="print:hidden">{fab}</div>
    </>
  );
}
