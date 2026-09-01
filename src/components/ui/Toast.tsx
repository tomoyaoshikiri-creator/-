"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const ToastContext = createContext<(message: string) => void>(() => {});

const DISPLAY_MS = 1800;
const FADE_MS = 250;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  const showToast = useCallback((msg: string) => {
    setQueue((q) => [...q, msg]);
  }, []);

  // キュー内の次のメッセージを取り出して表示対象にする。表示中(current !== null)の
  // 間は次を取り出さないことで、複数回toast()が呼ばれても1件ずつ順番に表示する。
  useEffect(() => {
    if (current !== null || queue.length === 0) return;
    setCurrent(queue[0]);
    setQueue((q) => q.slice(1));
  }, [queue, current]);

  // 表示中のメッセージを一定時間後にフェードアウトし、キューの次へ進める。
  // このeffectの依存配列は current のみにしてあるので、タイマーが自分自身の
  // cleanupで即座にキャンセルされてしまうことがない。
  useEffect(() => {
    if (current === null) return;
    setShow(true);
    const hideTimer = setTimeout(() => setShow(false), DISPLAY_MS);
    const clearTimer = setTimeout(() => setCurrent(null), DISPLAY_MS + FADE_MS);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(clearTimer);
    };
  }, [current]);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        className={`absolute left-4.5 right-4.5 bottom-[70px] bg-heading text-white text-center py-2.5 rounded-[10px] text-[12.5px] font-bold pointer-events-none transition-all z-50 ${
          show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        {current}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
