"use client";

import { createContext, useContext, useEffect, useState } from "react";

// 「専用作業画面」(スタッツ入力画面・スケジュール詳細画面等、下部5タブ・サイドバーを隠し
// 戻る+ハンバーガーのみにする画面)用の最小限のContext。Sidebar.tsx/TabBar.tsx自体は
// 変更せず、AppNav.tsxがこの状態を見て表示/非表示を切り替える。マウントしているページだけが
// useFocusMode(true)の間だけ有効。
const FocusModeContext = createContext<{ focusMode: boolean; setFocusMode: (v: boolean) => void } | null>(null);

export function FocusModeProvider({ children }: { children: React.ReactNode }) {
  const [focusMode, setFocusMode] = useState(false);
  return <FocusModeContext.Provider value={{ focusMode, setFocusMode }}>{children}</FocusModeContext.Provider>;
}

export function useFocusModeState() {
  const ctx = useContext(FocusModeContext);
  if (!ctx) throw new Error("useFocusModeState は FocusModeProvider の内側で使用してください");
  return ctx;
}

// 個別の画面から呼ぶ側のフック。enabledの間だけ通常ナビゲーションを隠し、
// アンマウント時(画面を離れる時)は必ず元に戻す。
export function useFocusMode(enabled: boolean) {
  const { setFocusMode } = useFocusModeState();
  useEffect(() => {
    if (!enabled) return;
    setFocusMode(true);
    return () => setFocusMode(false);
  }, [enabled, setFocusMode]);
}
