"use client";

import { useEffect, useState } from "react";

// PR #213 Safe Area調査用の一時的な実機診断オーバーレイ。
// investigation/pr213-nav-safearea-ab ブランチ専用(?debug=1で表示)。
// 「Safari/standaloneでアプリが実際に使える描画領域はどこまでか」を実機で
// 読み取れるようにするため、以下をまとめて表示する。
//   - standalone判定
//   - env(safe-area-inset-top/bottom)の実測値
//   - window.innerHeight / document.documentElement.clientHeight
//     (Safariのツールバー展開/収縮でどちらが変化し、どちらが変化しないかを見る)
//   - visualViewport.height / offsetTop(ビジュアルビューポートの実際の高さ・
//     ページ先頭からのオフセット)
//   - .app-shell自身の実測サイズ(getBoundingClientRect)。100dvhが実際に
//     どの値に解決されているか、position:fixedの基準とズレていないかを見る。
// 値は一定間隔・各種resize/scrollイベントで更新し、実機でその場で読み取れる
// ようにしている。
export function SafeAreaDebugOverlay() {
  const [info, setInfo] = useState("...");

  useEffect(() => {
    const probe = document.createElement("div");
    probe.style.position = "fixed";
    probe.style.top = "0";
    probe.style.left = "0";
    probe.style.visibility = "hidden";
    probe.style.paddingTop = "env(safe-area-inset-top)";
    probe.style.paddingBottom = "env(safe-area-inset-bottom)";
    document.body.appendChild(probe);

    const update = () => {
      const cs = getComputedStyle(probe);
      const standalone =
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches;
      const vv = window.visualViewport;
      const shell = document.querySelector(".app-shell");
      const shellRect = shell ? shell.getBoundingClientRect() : null;
      setInfo(
        [
          `standalone: ${standalone}`,
          `safe-top: ${cs.paddingTop} / safe-bottom: ${cs.paddingBottom}`,
          `innerHeight: ${window.innerHeight}px`,
          `clientHeight: ${document.documentElement.clientHeight}px`,
          `vv.h: ${vv ? Math.round(vv.height) : "n/a"}px  vv.offsetTop: ${vv ? Math.round(vv.offsetTop) : "n/a"}px`,
          `vv.scale: ${vv ? vv.scale.toFixed(2) : "n/a"}`,
          `shell.h: ${shellRect ? Math.round(shellRect.height) : "n/a"}px  shell.top: ${shellRect ? Math.round(shellRect.top) : "n/a"}px`,
          `updated: ${new Date().toLocaleTimeString("ja-JP")}`,
        ].join("\n"),
      );
    };

    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("scroll", update, true);
    const interval = window.setInterval(update, 1000);

    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("scroll", update, true);
      window.clearInterval(interval);
      probe.remove();
    };
  }, []);

  return (
    <div
      className="fixed top-1 right-1 z-50 whitespace-pre rounded bg-black/80 px-2 py-1 font-mono text-[9px] leading-tight text-white print:hidden"
      style={{ pointerEvents: "none" }}
    >
      {info}
    </div>
  );
}
