"use client";

import { useEffect } from "react";

// iOS/iPadOSのホーム画面追加(standalone PWA)モードには、ソフトウェアキーボード
// 表示時にWebKitがレイアウトビューポートを正しく再計算せず、position:fixed;
// inset:0の要素(.app-shell)が画面外に外れる/描画されなくなり、真っ白のまま
// 操作不能になる既知の不具合がある(ログイン画面のメールアドレス欄タップ時に
// 発生、という形で報告された。inputのfont-sizeは既に16px以上で自動ズームは
// 無関係)。inset:0の自動計算に任せず、visualViewport APIの実測値を
// CSS変数として明示的に渡すことで、キーボード表示/非表示のたびにWebKitへ
// 正しいサイズ・位置を再計算させる。visualViewport非対応環境では何もせず、
// globals.cssのフォールバック値(top:0 / height:100%、従来のinset:0相当)が
// そのまま使われる。
export function ViewportFix() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function apply() {
      const root = document.documentElement.style;
      root.setProperty("--vv-height", `${vv!.height}px`);
      root.setProperty("--vv-top", `${vv!.offsetTop}px`);
    }

    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    };
  }, []);

  return null;
}
