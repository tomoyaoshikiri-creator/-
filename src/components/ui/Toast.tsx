"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ToastContext = createContext<(message: string) => void>(() => {});

const DISPLAY_MS = 1800;
const FADE_MS = 250;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setQueue((q) => [...q, msg]);
  }, []);

  // キュー内の次のメッセージを表示する。同じフレーム内で複数回toast()が呼ばれても
  // 後発のメッセージが先発のメッセージを即座に上書きして消してしまわないよう、
  // 1件ずつ順番に表示してから次へ進む。
  useEffect(() => {
    if (current !== null || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next);
    setShow(true);
    timerRef.current = setTimeout(() => {
      setShow(false);
      timerRef.current = setTimeout(() => setCurrent(null), FADE_MS);
    }, DISPLAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [queue, current]);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        className={`absolute left-4.5 right-4.5 bottom-[70px] bg-navy text-white text-center py-2.5 rounded-[10px] text-[12.5px] font-bold pointer-events-none transition-all z-50 ${
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
