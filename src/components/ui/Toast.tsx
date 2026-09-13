"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const ToastContext = createContext<(message: string) => void>(() => {});

const DISPLAY_MS = 1800;
const FADE_MS = 250;

// 呼び出し側(300箇所近く)を個別に変更せずに済むよう、既存メッセージの一貫した命名規則
// (失敗時は必ず「〜に失敗しました」を含む)からエラートーストかどうかを自動判定する。
function isErrorMessage(message: string): boolean {
  return message.includes("失敗");
}

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

  const isError = current !== null && isErrorMessage(current);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {/*
        --dangerは小さなバッジ・ドット等、低コントラストでよい用途向けの値で、白文字を乗せる
        このToast背景にそのまま使うとWCAG AA(通常文字4.5:1)を満たせない。ここだけ同系色で
        コントラストを確保した濃い赤(#C22F35、白文字で約5.6:1)を使う。
      */}
      <div
        className={`absolute left-4.5 right-4.5 bottom-[70px] text-white text-center py-2.5 rounded-lg text-[12.5px] font-bold pointer-events-none transition-all z-50 ${
          isError ? "bg-[#C22F35]" : "bg-heading"
        } ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
      >
        {isError && (
          <span aria-hidden="true" className="mr-1">
            ⚠
          </span>
        )}
        {current}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
