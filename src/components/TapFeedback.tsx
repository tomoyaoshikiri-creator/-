"use client";

import { useEffect } from "react";

// globals.cssのbutton:active(マウス向け)だけでは、実機のタップ操作で
// 「押した感じが全く無い」と報告された。実タップは:activeが描画される前に
// click/状態更新まで完了してしまうことが多く(特にページ遷移を伴うボタン)、
// CSSの:activeだけに頼ると視覚的に間に合わないケースがある。ここでは
// pointerdown時点で即座にクラスを付け、最低でも一定時間は保持してから外す
// ことで、どんなに速いタップでも必ず1フレームは押し込み表示を見せる。
// button要素だけでなく、SettingsRowやカード一覧行などボタンと同じ見た目で
// 使われているaタグ(href付き)も対象にする。
//
// ボタン/リンクの上から指を離さずスクロールを始めるケース(タップではない)では、
// 一定距離動いた時点でpointerup/pointercancelを待たずに即座にクラスを外す。
// これを入れていないと、スクロール中ずっとtransform/filterが掛かった状態になり、
// iOS Safari実機でその要素が一瞬完全に非表示になる不具合が報告された
// (スクロール開始位置がたまたまカード/リンクの上だった場合に発生)。
const PRESSED_CLASS = "is-pressed";
const MIN_VISIBLE_MS = 90;
const MOVE_CANCEL_PX = 10;
const PRESSABLE_SELECTOR = "button:not(:disabled), a[href]";

export function TapFeedback() {
  useEffect(() => {
    let current: HTMLElement | null = null;
    let pressedAt = 0;
    let startX = 0;
    let startY = 0;

    function targetButton(e: Event): HTMLElement | null {
      return (e.target as HTMLElement | null)?.closest<HTMLElement>(PRESSABLE_SELECTOR) ?? null;
    }

    function onDown(e: PointerEvent) {
      const btn = targetButton(e);
      if (!btn) return;
      current = btn;
      pressedAt = Date.now();
      startX = e.clientX;
      startY = e.clientY;
      btn.classList.add(PRESSED_CLASS);
    }

    function onMove(e: PointerEvent) {
      if (!current) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) {
        const btn = current;
        current = null;
        btn.classList.remove(PRESSED_CLASS);
      }
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
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerup", release, { passive: true });
    document.addEventListener("pointercancel", release, { passive: true });

    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", release);
      document.removeEventListener("pointercancel", release);
    };
  }, []);

  return null;
}
