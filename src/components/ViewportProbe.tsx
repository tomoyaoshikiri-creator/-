"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Preview限定の診断用。個人情報・認証情報・storageを取得・送信しない。
// UIレイアウトは一切変更せず、数値と画面端の基準線だけを重ねる。
export function ViewportProbe() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState("");
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted || !open) return;
    const measure = () => {
      const shell = document.querySelector<HTMLElement>(".app-shell");
      const tab = document.querySelector<HTMLElement>("[data-viewport-tab]");
      const scroll = document.querySelector<HTMLElement>("[data-viewport-scroll]");
      const root = document.documentElement;
      const vv = window.visualViewport;
      const round = (n: number) => Math.round(n * 10) / 10;
      const rect = (e: HTMLElement | null) => {
        if (!e) return "none";
        const r = e.getBoundingClientRect();
        return `top=${round(r.top)} bottom=${round(r.bottom)} h=${round(r.height)}`;
      };
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)";
      document.body.appendChild(probe);
      const cs = getComputedStyle(probe);
      const safe = `top=${cs.paddingTop} bottom=${cs.paddingBottom}`;
      probe.remove();
      const units = ["vh", "svh", "dvh", "lvh"].map(unit => {
        const e = document.createElement("div");
        e.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;height:100${unit}`;
        document.body.appendChild(e);
        const h = round(e.getBoundingClientRect().height);
        e.remove();
        return `${unit}=${h}`;
      }).join(" ");
      const standalone = matchMedia("(display-mode:standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setReport([
        "CIRCLE LINES / VIEWPORT PROBE v3",
        `mode=${standalone ? "standalone" : "browser"} path=${location.pathname}`,
        `screen=${screen.width}x${screen.height} inner=${innerWidth}x${innerHeight}`,
        `client=${root.clientWidth}x${root.clientHeight}`,
        `visual=${vv ? `${round(vv.width)}x${round(vv.height)} offsetTop=${round(vv.offsetTop)}` : "unsupported"}`,
        units, `safe=${safe}`,
        `shell=${rect(shell)}`,
        `tab=${rect(tab)}`,
        `scroll=${rect(scroll)}`,
        `shell CSS height=${shell ? getComputedStyle(shell).height : "none"}`,
        `tab bottom gap to inner=${tab ? round(innerHeight - tab.getBoundingClientRect().bottom) : "none"}`,
        `scrollHeight=${scroll?.scrollHeight ?? "none"} clientHeight=${scroll?.clientHeight ?? "none"}`
      ].join("\n"));
    };
    measure();
    const id = window.setInterval(measure, 800);
    window.addEventListener("resize", measure);
    return () => { window.clearInterval(id); window.removeEventListener("resize", measure); };
  }, [mounted, open]);
  if (!mounted) return null;
  return createPortal(
    <>
      {open && (
        <>
          <div aria-hidden style={{position:"fixed",left:0,right:0,bottom:0,height:3,background:"#e11d48",zIndex:9997,pointerEvents:"none"}} />
          <div aria-hidden style={{position:"fixed",left:0,right:0,top:"100dvh",height:3,background:"#2563eb",zIndex:9997,pointerEvents:"none"}} />
        </>
      )}
      <aside style={{position:"fixed",zIndex:9998,top:72,right:8,maxWidth:"min(96vw,390px)",background:"#152638",color:"white",borderRadius:8,padding:8,fontSize:12}}>
        <button type="button" onClick={() => setOpen(!open)} style={{minHeight:44,padding:"8px 12px",fontWeight:700}}>{open ? "計測を閉じる" : "画面端を計測"}</button>
        {open && <>
          <pre style={{fontSize:11,whiteSpace:"pre-wrap",overflowWrap:"anywhere",maxHeight:"48dvh",overflowY:"auto",margin:"6px 0"}}>{report}</pre>
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(report); }} style={{minHeight:44,padding:"8px 12px",fontWeight:700}}>結果をコピー</button>
          <div style={{fontSize:10}}>赤線=viewport下端 / 青線=100dvh下端</div>
        </>}
      </aside>
    </>, document.body
  );
}
