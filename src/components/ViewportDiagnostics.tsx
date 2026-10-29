"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Preview-only, read-only measurements. Never read page text, input values,
// cookies or storage, and never send measurements over the network.
export function ViewportDiagnostics() {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [report, setReport] = useState("");
  const probeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setReady(true);
      setOpen(new URLSearchParams(window.location.search).get("viewport_debug") === "1");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const viewport = window.visualViewport;
    const round = (value: number) => Math.round(value * 10) / 10;
    const measure = () => {
      frame = 0;
      const shell = document.querySelector<HTMLElement>(".app-shell");
      const content = document.querySelector<HTMLElement>("[data-page-scroll]");
      const sidebar = document.querySelector<HTMLElement>("[data-sidebar-scroll]");
      const root = document.documentElement;
      const standalone = window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const describe = (label: string, element: HTMLElement | null) => {
        if (!element) return `${label}: none`;
        const rect = element.getBoundingClientRect();
        return `${label}: top=${round(rect.top)} h=${round(rect.height)} bottom=${round(rect.bottom)}\n` +
          `  scroll=${round(element.scrollTop)}/${element.scrollHeight - element.clientHeight}`;
      };
      const probe = probeRef.current;
      const units = probe ? Array.from(probe.children).map((element) =>
        `${element.getAttribute("data-unit")}=${round(element.getBoundingClientRect().height)}`,
      ).join(" ") : "";
      const safeArea = probe ? getComputedStyle(probe) : null;
      const contentEnd = content?.lastElementChild?.getBoundingClientRect();
      const lines = [
        "VIEWPORT v1 — CSS px",
        `mode=${standalone ? "standalone" : "browser"}`,
        `screen=${screen.width}x${screen.height} inner=${innerWidth}x${innerHeight}`,
        `client=${root.clientWidth}x${root.clientHeight} rootScroll=${round(scrollY)}`,
        viewport ? `visual=${round(viewport.width)}x${round(viewport.height)} top=${round(viewport.offsetTop)} scale=${round(viewport.scale)}` : "visual=unsupported",
        units,
        `safe top=${safeArea?.paddingTop ?? "?"} bottom=${safeArea?.paddingBottom ?? "?"}`,
        describe("shell", shell),
        describe("sidebar", sidebar),
        describe("content", content),
        contentEnd ? `contentLast.bottom=${round(contentEnd.bottom)}` : "contentLast=none",
      ];
      const nextReport = lines.join("\n");
      setReport((previous) => previous === nextReport ? previous : nextReport);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    for (const element of document.querySelectorAll(".app-shell, [data-page-scroll], [data-sidebar-scroll]")) {
      observer.observe(element);
    }
    document.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("pageshow", schedule);
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pageshow", schedule);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
    };
  }, [open]);

  if (!ready) return null;
  return createPortal(
    <aside
      aria-label="表示領域の計測"
      style={{ position: "fixed", zIndex: 9999, right: 8, top: "calc(env(safe-area-inset-top) + 8px)", maxWidth: "calc(100vw - 16px)", padding: 8, borderRadius: 6, background: "#152638", color: "#ffffff", boxShadow: "0 2px 8px #0004" }}
    >
      <button type="button" onClick={() => setOpen((value) => !value)} style={{ fontSize: 13, padding: "8px 12px", minHeight: 44 }}>
        {open ? "計測を閉じる" : "表示を計測"}
      </button>
      {open && <>
        <pre style={{ font: "11px/1.5 monospace", whiteSpace: "pre-wrap", margin: "4px 0", maxHeight: "50dvh", overflow: "auto" }}>{report}</pre>
        <button type="button" onClick={() => {
          for (const element of document.querySelectorAll<HTMLElement>("[data-page-scroll], [data-sidebar-scroll]")) {
            element.scrollTop = element.scrollHeight;
          }
        }} style={{ fontSize: 13, padding: "8px 12px", minHeight: 44 }}>本文・サイドバーを最下部へ</button>
        <div ref={probeRef} aria-hidden="true" style={{ position: "fixed", visibility: "hidden", pointerEvents: "none", width: 0, height: 0, overflow: "hidden", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div data-unit="vh" style={{ position: "absolute", height: "100vh" }} />
          <div data-unit="svh" style={{ position: "absolute", height: "100svh" }} />
          <div data-unit="dvh" style={{ position: "absolute", height: "100dvh" }} />
          <div data-unit="lvh" style={{ position: "absolute", height: "100lvh" }} />
        </div>
      </>}
    </aside>,
    document.body,
  );
}
