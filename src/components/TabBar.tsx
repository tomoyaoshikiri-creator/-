"use client";

import { usePathname } from "next/navigation";
import type { Role } from "@/lib/database.types";
import { TAB_LABELS, tabHrefForRole, tabsForRole, type TabKey } from "@/lib/permissions";
import { TAB_ICONS } from "@/components/tabIcons";
import { LockIcon } from "@/components/icons";
import { GuardedLink } from "@/components/GuardedLink";
import { useSession } from "@/lib/session-context";
import { useUpgradePrompt } from "@/components/PlanLock";
import { hasCoachNoteAccess } from "@/lib/plan";

export function TabBar({ role, badges = {} }: { role: Role; badges?: Partial<Record<TabKey, boolean>> }) {
  const pathname = usePathname();
  const { plan } = useSession();
  const promptUpgrade = useUpgradePrompt();
  const tabs = tabsForRole(role);
  // 管理者はタブ数が8個と最も多く、フルディスプレイのiPhoneでは端の項目が
  // 画面の丸みや安全域ぎりぎりに寄ってしまうため、左右の余白を少し多めに取って内側に寄せる。
  const dense = tabs.length >= 8;
  // プラン不足で使えないタブはグレーアウト+鍵アイコンにし、タップで案内する
  // (完全に隠すと機能の存在に気づけないため)。
  const locked: Partial<Record<TabKey, boolean>> = { coachNote: !hasCoachNoteAccess(plan) };

  return (
    // Phase UI-2B: 一時期「ナビゲーションコンテンツ」と「Safe Area」を別要素(専用spacer div)に
    // 分離し、bottom paddingとenv(safe-area-inset-bottom)を完全に加算する構成を試したが、
    // 元々の30px(pb-7.5)自体が大半の実機のホームインジケータ領域とほぼ同じ役割を果たせる
    // 大きさであったため、「30px + Safe Area全部」の単純加算(実機で最大64px)は下部余白が
    // 過剰になる回帰を招いた。ここでは単一のpadding-bottomに戻し、通常時の自然な余白(30px)と
    // env(safe-area-inset-bottom)の大きい方だけを採用する(置き換えでも加算でもない)ことで、
    // Safe Areaがない端末では元の見た目を保ちつつ、Safe Areaがある端末でも下部余白が
    // 34px程度(元の30pxとほぼ同等)に収まるようにする。
    // さらに、viewport-fit=cover導入前はSafe Area自体がTabBarの一部ではなかったため、
    // 実機上の総占有量はSafe Areaの分だけ純増している。これを完全には相殺できないため、
    // pt-2.5(10px)をpt-1.5(6px)へ詰め、アイコン・ラベル自体やgapは変更せず、
    // Safe Area込みの総占有量を改修前(3ca9e71)へ可能な限り近づける。
    <nav
      className={`min-[700px]:hidden flex items-start pt-1.5 border-t border-line bg-white ${
        dense ? "px-3" : "px-1"
      }`}
      style={{ paddingBottom: "max(1.875rem, env(safe-area-inset-bottom))" }}
    >
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab];
        const href = tabHrefForRole(role, tab);
        const isActive = pathname === href || pathname.startsWith(href + "/");
        const isLocked = locked[tab];
        const className = `flex-1 min-w-0 text-center text-[7.5px] font-medium flex flex-col items-center gap-0.5 ${
          isLocked ? "text-ink-soft/50" : isActive ? "text-orange font-bold" : "text-ink-soft"
        }`;
        const content = (
          <>
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
  );
}
