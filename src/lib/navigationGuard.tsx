"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const CONFIRM_MESSAGE = "保存されていない変更があります。このまま移動しますか？";

interface NavigationGuardContextValue {
  isDirty: boolean;
  registerDirty: (id: string, dirty: boolean) => void;
  guardedNavigate: (href: string) => void;
}

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null);

// アプリ内の複数の入力画面(選手ごとの出欠フォームなど)が同時にマウントされることがあるため、
// 単純なbooleanではなく「未保存のフォームのID集合」で管理する。1つでも残っていれば未保存扱い。
export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const isDirty = dirtyIds.size > 0;
  const isDirtyRef = useRef(isDirty);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirtyRef.current) return;
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const registerDirty = useCallback((id: string, dirty: boolean) => {
    setDirtyIds((prev) => {
      const has = prev.has(id);
      if (dirty === has) return prev;
      const next = new Set(prev);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const guardedNavigate = useCallback(
    (href: string) => {
      if (isDirtyRef.current && !window.confirm(CONFIRM_MESSAGE)) return;
      setDirtyIds(new Set());
      router.push(href);
    },
    [router],
  );

  return (
    <NavigationGuardContext.Provider value={{ isDirty, registerDirty, guardedNavigate }}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  const ctx = useContext(NavigationGuardContext);
  if (!ctx) throw new Error("useNavigationGuard は NavigationGuardProvider の内側で使用してください");
  return ctx;
}

// フォーム側は「今、未保存の変更があるかどうか」のbooleanを渡すだけでよい。
// 画面を離れる(アンマウントする)ときは自動的に登録解除する。
export function useUnsavedChangesGuard(dirty: boolean) {
  const id = useId();
  const { registerDirty } = useNavigationGuard();

  useEffect(() => {
    registerDirty(id, dirty);
  }, [id, dirty, registerDirty]);

  useEffect(() => {
    return () => registerDirty(id, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
}
