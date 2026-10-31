"use client";

import { useEffect, useState } from "react";

// PR #213 Safe Area調査用の一時的な実機診断オーバーレイ。
// investigation/pr213-nav-safearea-ab ブランチ専用(?debug=1で表示)。
// standalone判定・env(safe-area-inset-*)の実測値・visualViewportの高さを
// 画面上に表示し、Safari/standaloneでの挙動差を実機で確認しやすくする。
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
      setInfo(
        [
          `standalone: ${standalone}`,
          `safe-top: ${cs.paddingTop}`,
          `safe-bottom: ${cs.paddingBottom}`,
          `innerHeight: ${window.innerHeight}px`,
          `visualViewport.h: ${vv ? Math.round(vv.height) : "n/a"}px`,
          `visualViewport.offsetTop: ${vv ? Math.round(vv.offsetTop) : "n/a"}px`,
        ].join("\n"),
      );
    };

    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    const interval = window.setInterval(update, 1000);

    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.clearInterval(interval);
      probe.remove();
    };
  }, []);

  return (
    <div
      className="fixed bottom-1 right-1 z-50 whitespace-pre rounded bg-black/80 px-2 py-1 font-mono text-[9px] leading-tight text-white print:hidden"
      style={{ pointerEvents: "none" }}
    >
      {info}
    </div>
  );
}
