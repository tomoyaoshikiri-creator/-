"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/database.types";
import { TAB_LABELS, tabHrefForRole, tabsForRole, type TabKey } from "@/lib/permissions";
import { TAB_ICONS } from "@/components/tabIcons";
import { LockIcon } from "@/components/icons";
import { GuardedLink } from "@/components/GuardedLink";
import { useSession } from "@/lib/session-context";
import { useUpgradePrompt } from "@/components/PlanLock";
import { hasCoachNoteAccess } from "@/lib/plan";

// 一時的な計測用オーバーレイ。padding-bottom: 0まで詰めても実機の余白が変わらない
// 原因を切り分けるため、TabBar自体のCSSではなく画面下端との実際のズレを直接測る。
// 原因特定後にこのコンポーネントごと削除する。
function SafeAreaDebugOverlay({ navRef }: { navRef: React.RefObject<HTMLElement | null> }) {
  const [info, setInfo] = useState<string>("計測中...");

  useEffect(() => {
    const measure = () => {
      const nav = navRef.current;
      if (!nav) return;
      const navRect = nav.getBoundingClientRect();
      const shell = nav.closest(".app-shell") as HTMLElement | null;
      const shellRect = shell?.getBoundingClientRect();
      const probe = document.createElement("div");
      probe.style.position = "fixed";
      probe.style.bottom = "0";
      probe.style.height = "0";
      probe.style.paddingBottom = "env(safe-area-inset-bottom)";
      probe.style.visibility = "hidden";
      document.body.appendChild(probe);
      const insetBottom = getComputedStyle(probe).paddingBottom;
      document.body.removeChild(probe);

      const lines = [
        `innerHeight: ${window.innerHeight}`,
        `docEl.clientHeight: ${document.documentElement.clientHeight}`,
        `env(safe-area-inset-bottom): ${insetBottom}`,
        `app-shell bottom: ${shellRect?.bottom.toFixed(1) ?? "N/A"}`,
        `nav(TabBar) bottom: ${navRect.bottom.toFixed(1)}`,
        `gap shell→viewport: ${(window.innerHeight - (shellRect?.bottom ?? 0)).toFixed(1)}`,
        `gap nav→viewport: ${(window.innerHeight - navRect.bottom).toFixed(1)}`,
      ];
      setInfo(lines.join("\n"));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [navRef]);

  return (
    <div
      style={{
        position: "fixed",
        top: 4,
        left: 4,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        color: "#0f0",
        fontSize: 9,
        lineHeight: 1.4,
        fontFamily: "monospace",
        padding: "4px 6px",
        borderRadius: 4,
        whiteSpace: "pre",
        pointerEvents: "none",
      }}
    >
      {info}
    </div>
  );
}

export function TabBar({ role, badges = {} }: { role: Role; badges?: Partial<Record<TabKey, boolean>> }) {
  const pathname = usePathname();
  const { plan } = useSession();
  const promptUpgrade = useUpgradePrompt();
  const tabs = tabsForRole(role);
  const navRef = useRef<HTMLElement>(null);
  // 管理者はタブ数が8個と最も多く、フルディスプレイのiPhoneでは端の項目が
  // 画面の丸みや安全域ぎりぎりに寄ってしまうため、左右の余白を少し多めに取って内側に寄せる。
  const dense = tabs.length >= 8;
  // プラン不足で使えないタブはグレーアウト+鍵アイコンにし、タップで案内する
  // (完全に隠すと機能の存在に気づけないため)。
  const locked: Partial<Record<TabKey, boolean>> = { coachNote: !hasCoachNoteAccess(plan) };

  return (
    <>
    <SafeAreaDebugOverlay navRef={navRef} />
    {/* pb-1(4px)まで削っても改修前の見た目とはまだ差があったため、padding-bottomの
        理論上の下限であるpb-0まで削った。ここでも余白が変わらなかったため、TabBar自体の
        paddingではなく外側(display:standaloneのsafe-area処理等)が原因と切り分けるための
        計測用オーバーレイ(SafeAreaDebugOverlay)を追加している。icon(19px)・gap・
        labelのサイズ、タップ領域拡張の仕組みは変更していない。 */}
    <nav
      ref={navRef}
      className={`min-[700px]:hidden flex items-start pt-2.5 pb-0 border-t border-line bg-white ${
        dense ? "px-3" : "px-1"
      }`}
    >
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab];
        const href = tabHrefForRole(role, tab);
        const isActive = pathname === href || pathname.startsWith(href + "/");
        const isLocked = locked[tab];
        const className = `relative flex-1 min-w-0 text-center text-[7.5px] font-medium flex flex-col items-center gap-0.5 ${
          isLocked ? "text-ink-soft/50" : isActive ? "text-orange font-bold" : "text-ink-soft"
        }`;
        const content = (
          <>
            {/* 視覚サイズを変えずにタップ領域だけを広げる透明ヒットエリア。position:absoluteで
                通常のflexレイアウトから外れるため、TabBar自体の高さには影響しない
                (親要素<nav>・<button>/<a>本体にoverflow指定がないため、この範囲まで正しく
                タップを拾える)。visual contentは変えず、44px相当の操作性を確保する。 */}
            <span aria-hidden className="absolute -inset-y-[7px] inset-x-0" />
            <span className="relative inline-flex">
              <Icon className="w-[19px] h-[19px]" />
              {isLocked ? (
                <span className="absolute -top-1 -right-1 w-[11px] h-[11px] rounded-full bg-paper border border-line flex items-center justify-center">
                  <LockIcon className="w-[7px] h-[7px] text-ink-soft" />
                </span>
              ) : (
                badges[tab] && (
                  <span className="absolute -top-0.5 -right-0.5 w-[9px] h-[9px] rounded-full bg-danger border border-white" />
                )
              )}
            </span>
            <span className="whitespace-nowrap">{TAB_LABELS[tab]}</span>
          </>
        );
        if (isLocked) {
          return (
            <button
              key={tab}
              type="button"
              onClick={() => promptUpgrade(`${TAB_LABELS[tab]}は上位プランで利用できます`)}
              className={className}
            >
              {content}
            </button>
          );
        }
        return (
          <GuardedLink key={tab} href={href} className={className}>
            {content}
          </GuardedLink>
        );
      })}
    </nav>
    </>
  );
}
