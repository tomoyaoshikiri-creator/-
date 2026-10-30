"use client";

import { createContext, useContext, useEffect, useState } from "react";

// スタッツ入力画面等の「専用作業画面」がマウント中だけ、通常の下部ナビゲーション
// (TabBar/Sidebar)を隠し、画面側が用意する専用操作バーに置き換えるための仕組み。
// AppNav.tsxがこのContextを読んで出し分けるだけで、TabBar/Sidebar自体の内部実装は
// 変更しない。
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
