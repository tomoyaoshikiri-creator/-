"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type ToastKind = "success" | "error" | "warning";

interface ToastEntry {
  message: string;
  kind: ToastKind;
}

export interface ToastFn {
  (message: string): void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
}

const noop = () => {};
const defaultToastFn: ToastFn = Object.assign(noop, { success: noop, error: noop, warning: noop });
const ToastContext = createContext<ToastFn>(defaultToastFn);

const DISPLAY_MS = 1800;
const FADE_MS = 250;

// 種類を指定しない呼び出し(移行漏れ・将来の呼び出し漏れへの保険)専用のフォールバック判定。
// 既存メッセージの命名規則(失敗時は必ず「〜に失敗しました」を含む)から
// エラートーストかどうかを自動判定する。
function inferKind(message: string): ToastKind {
  return message.includes("失敗") ? "error" : "success";
}

// --danger(#E5484D)・--green(#16A34A)は小さなバッジ等、低コントラストでよい用途向けの値で、
// 白文字を乗せるこのToast背景にそのまま使うとWCAG AA(通常文字4.5:1)を満たせない。
// ここだけ同系色でコントラストを確保した色を使う(赤#C22F35で約5.6:1、緑・オレンジで約5.0:1)。
const KIND_STYLE: Record<ToastKind, { bg: string; icon: string | null }> = {
  success: { bg: "bg-[#15803D]", icon: "✓" },
  warning: { bg: "bg-[#B45309]", icon: "!" },
  error: { bg: "bg-[#C22F35]", icon: "⚠" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<ToastEntry[]>([]);
  const [current, setCurrent] = useState<ToastEntry | null>(null);
  const [show, setShow] = useState(false);

  const enqueue = useCallback((message: string, kind: ToastKind) => {
    setQueue((q) => [...q, { message, kind }]);
  }, []);

  const toast = useMemo<ToastFn>(
    () =>
      Object.assign((message: string) => enqueue(message, inferKind(message)), {
        success: (message: string) => enqueue(message, "success"),
        error: (message: string) => enqueue(message, "error"),
        warning: (message: string) => enqueue(message, "warning"),
      }),
    [enqueue],
  );

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

  const style = current ? KIND_STYLE[current.kind] : null;

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className={`absolute left-4.5 right-4.5 bottom-[70px] text-white text-center py-2.5 rounded-lg text-[12.5px] font-bold pointer-events-none transition-all z-50 ${
          style?.bg ?? "bg-[#15803D]"
        } ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
      >
        {style?.icon && (
          <span aria-hidden="true" className="mr-1">
            {style.icon}
          </span>
        )}
        {current?.message}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  return useContext(ToastContext);
}
