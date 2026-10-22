"use client";

import { useEffect, useState } from "react";

// 一時的な調査用オーバーレイ。「画面全体が下にズレてタブバーが切れる」不具合の
// 原因を推測で直そうとして2回失敗したため、実機の実測値を直接取得する。
// 原因特定後、このファイルと呼び出し箇所は削除する。
export function ViewportDebugOverlay() {
  const [info, setInfo] = useState<string[]>([]);

  useEffect(() => {
    function measure() {
      const lines: string[] = [];
      lines.push(`UA: ${navigator.userAgent}`);
      lines.push(`standalone: ${(navigator as unknown as { standalone?: boolean }).standalone}`);
      lines.push(`screen: ${screen.width}x${screen.height} dpr:${window.devicePixelRatio}`);
      lines.push(`innerW/H: ${window.innerWidth}x${window.innerHeight}`);
      lines.push(
        `visualViewport: ${window.visualViewport?.width}x${window.visualViewport?.height} offsetTop:${window.visualViewport?.offsetTop}`,
      );
      lines.push(
        `documentElement.client: ${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`,
      );

      const shell = document.querySelector(".app-shell");
      if (shell) {
        const r = shell.getBoundingClientRect();
        const cs = getComputedStyle(shell);
        lines.push(
          `.app-shell rect: top:${r.top.toFixed(1)} bottom:${r.bottom.toFixed(1)} h:${r.height.toFixed(1)}`,
        );
        lines.push(`.app-shell computed height: ${cs.height} / position: ${cs.position}`);
      } else {
        lines.push(".app-shell: not found");
      }

      const tabbar = document.querySelector("nav.min-\\[700px\\]\\:hidden");
      if (tabbar) {
        const r = tabbar.getBoundingClientRect();
        lines.push(`TabBar rect: top:${r.top.toFixed(1)} bottom:${r.bottom.toFixed(1)} h:${r.height.toFixed(1)}`);
      } else {
        lines.push("TabBar: not found");
      }

      const probe = document.createElement("div");
      probe.style.position = "fixed";
      probe.style.top = "0";
      probe.style.paddingTop = "env(safe-area-inset-top)";
      probe.style.paddingBottom = "env(safe-area-inset-bottom)";
      probe.style.visibility = "hidden";
      document.body.appendChild(probe);
      const probeCs = getComputedStyle(probe);
      lines.push(`safe-area-inset top/bottom: ${probeCs.paddingTop} / ${probeCs.paddingBottom}`);
      document.body.removeChild(probe);

      setInfo(lines);
    }
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999999,
        background: "rgba(255,0,200,0.92)",
        color: "#fff",
        fontSize: "9px",
        lineHeight: 1.4,
        fontFamily: "monospace",
        padding: "4px 6px",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
        pointerEvents: "none",
      }}
    >
      {info.join("\n")}
    </div>
  );
}
