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
    // Phase UI-2B: padding-bottomだけでSafe Areaを表現しようとすると(max()でもcalc()でも)、
    // env(safe-area-inset-bottom)の値がアイコン・ラベルを含む行自体の高さに影響してしまい、
    // 実機で「アイコン・ラベルが上端に寄り、その下に不均衡な余白ができる」問題を繰り返した。
    // ここでは「ナビゲーションコンテンツ(アイコン+ラベル)」と「Safe Area」を別要素に分離し、
    // 前者は元デザイン(pt-2.5 pb-7.5 items-start)と完全に同じ高さ・配置を常に維持したまま、
    // 後者だけがenv()の値に応じて下に追加される専用スペーサーとする。
    <nav className="min-[700px]:hidden border-t border-line bg-white">
      <div className={`flex items-start pt-2.5 pb-7.5 ${dense ? "px-3" : "px-1"}`}>
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
      </div>
      {/* Safe Area(ホームインジケータ)保護用の専用スペーサー。ナビゲーションコンテンツの
          flexレイアウトには一切参加しないため、env()の値がアイコン・ラベルの位置に影響しない。 */}
      <div style={{ height: "env(safe-area-inset-bottom)" }} />
    </nav>
  );
}
