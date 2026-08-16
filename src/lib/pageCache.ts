"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

// タブを行き来するたびにSupabaseへ再取得しに行くと、通信が終わるまで画面が
// 固まって見えてしまう。訪問済みのタブは直前の取得結果をこのMapに残しておき、
// 再訪問時はまずそれを即座に表示しつつ、裏でload()を呼んで最新化する
// (stale-while-revalidate)。ブラウザタブを閉じる/リロードするまでの間だけ有効。
const cache = new Map<string, unknown>();

export function hasCachedValue(key: string): boolean {
  return cache.has(key);
}

export function useCachedState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  // keyRef経由でsetCachedStateのアイデンティティを固定し、useState純正のsetterと同じく
  // 「呼び出し側の依存配列に入れなくても常に最新を指す」という前提を崩さないようにする。
  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  });
  const [state, setState] = useState<T>(() => (cache.has(key) ? (cache.get(key) as T) : initialValue));

  const setCachedState: Dispatch<SetStateAction<T>> = useCallback((value) => {
    setState((prev) => {
      const next = typeof value === "function" ? (value as (p: T) => T)(prev) : value;
      cache.set(keyRef.current, next);
      return next;
    });
  }, []);

  return [state, setCachedState];
}
