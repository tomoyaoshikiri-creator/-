"use client";

import { useEffect, useState } from "react";

// 一時的な調査用オーバーレイ。「タブバーが画面外に隠れている」「画面上部に白い帯が
// 出る」不具合の原因を実測するため、右下に小さく数値を表示する(前回は上部を
// 覆ってしまい肝心の白帯が見えなかったため、位置を変更)。原因特定後、この
// ファイルと呼び出し箇所は削除する。
export function ViewportDebugOverlay() {
  const [info, setInfo] = useState<string[]>([]);

  useEffect(() => {
    function measure() {
      const lines: string[] = [];
      lines.push(`screen:${screen.width}x${screen.height}`);
      lines.push(`inner:${window.innerWidth}x${window.innerHeight}`);
      lines.push(`vv:${window.visualViewport?.width}x${window.visualViewport?.height} off:${window.visualViewport?.offsetTop}`);

      const shell = document.querySelector(".app-shell");
      if (shell) {
        const r = shell.getBoundingClientRect();
        const overflowY = r.height - window.innerHeight;
        lines.push(`shell:top${r.top.toFixed(0)} bot${r.bottom.toFixed(0)} h${r.height.toFixed(0)} overflow:${overflowY.toFixed(0)}`);
      } else {
        lines.push("shell: not found");
      }

      const header = document.querySelector("header, [class*='header']");
      if (header) {
        const r = header.getBoundingClientRect();
        lines.push(`header:top${r.top.toFixed(0)} bot${r.bottom.toFixed(0)}`);
      }

      const tabbar = document.querySelector("nav.min-\\[700px\\]\\:hidden");
      if (tabbar) {
        const r = tabbar.getBoundingClientRect();
        const belowFold = r.bottom - window.innerHeight;
        lines.push(`tabbar:top${r.top.toFixed(0)} bot${r.bottom.toFixed(0)} belowFold:${belowFold.toFixed(0)}`);
      } else {
        lines.push("tabbar: NOT FOUND IN DOM");
      }

      setInfo(lines);
    }
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    const t = setInterval(measure, 1000);
    return () => {
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      clearInterval(t);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 60,
        left: 4,
        right: 4,
        zIndex: 999999,
        background: "rgba(0,0,0,0.85)",
        color: "#0f0",
        fontSize: "8.5px",
        lineHeight: 1.35,
        fontFamily: "monospace",
        padding: "4px 6px",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
        pointerEvents: "none",
        borderRadius: 4,
      }}
    >
      {info.join("\n")}
    </div>
  );
}
