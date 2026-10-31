"use client";

import { createContext, useContext, useEffect, useState } from "react";

// 「専用作業画面」(下部5タブ・サイドバーを隠し、戻る+ハンバーガーのみにする画面)用の
// 最小限のContext。Sidebar.tsx/TabBar.tsx自体は変更せず、AppNav.tsxがこの状態を見て
// 表示/非表示を切り替える。マウントしているページだけがuseFocusMode(true)の間だけ有効。
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

export function useFocusMode(enabled: boolean) {
  const { setFocusMode } = useFocusModeState();
  useEffect(() => {
    if (!enabled) return;
    setFocusMode(true);
    return () => setFocusMode(false);
  }, [enabled, setFocusMode]);
}
