"use client";

import { useFocusModeState } from "@/lib/focusMode";

// Phase 3で下部ナビをフローティング型のピルに変更したため(TabBar.tsx)、
// 通常画面(focusMode=false)ではコンテンツ最下部がピルの裏に隠れないよう、
// 共通レイアウト側でこのスクロール領域に十分な下部余白を確保する。
// 専用作業画面(focusMode=true、スタッツ入力画面・スケジュール詳細画面)は
// 画面側で既に専用操作バー分の余白を個別に用意しているため、ここでは
// 従来通りの余白(pb-5)のまま変更しない(二重に余白が付くのを防ぐため)。
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
  return (
    <>
      <div className="print:hidden">{header}</div>
      <div
        className={`flex-1 overflow-y-auto px-4.5 pt-4 ${focusMode ? "pb-5" : "pb-28"} relative min-[700px]:px-8 min-[700px]:pt-6 print:overflow-visible print:p-0`}
      >
        {children}
      </div>
      <div className="print:hidden">{fab}</div>
    </>
  );
}
