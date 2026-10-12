"use client";

import { useEffect } from "react";

// globals.cssのbutton:active(マウス向け)だけでは、実機のタップ操作で
// 「押した感じが全く無い」と報告された。実タップは:activeが描画される前に
// click/状態更新まで完了してしまうことが多く(特にページ遷移を伴うボタン)、
// CSSの:activeだけに頼ると視覚的に間に合わないケースがある。ここでは
// pointerdown時点で即座にクラスを付け、最低でも一定時間は保持してから外す
// ことで、どんなに速いタップでも必ず1フレームは押し込み表示を見せる。
const PRESSED_CLASS = "is-pressed";
const MIN_VISIBLE_MS = 90;

export function TapFeedback() {
  useEffect(() => {
    let current: HTMLElement | null = null;
    let pressedAt = 0;

    function targetButton(e: Event): HTMLElement | null {
      return (e.target as HTMLElement | null)?.closest<HTMLElement>("button:not(:disabled)") ?? null;
    }

    function onDown(e: PointerEvent) {
      const btn = targetButton(e);
      if (!btn) return;
      current = btn;
      pressedAt = Date.now();
      btn.classList.add(PRESSED_CLASS);
    }

    function release() {
      const btn = current;
      if (!btn) return;
      current = null;
      const elapsed = Date.now() - pressedAt;
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
      window.setTimeout(() => btn.classList.remove(PRESSED_CLASS), wait);
    }

    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("pointerup", release, { passive: true });
    document.addEventListener("pointercancel", release, { passive: true });

    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", release);
      document.removeEventListener("pointercancel", release);
    };
  }, []);

  return null;
}
