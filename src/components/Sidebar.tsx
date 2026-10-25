"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/database.types";
import {
  BOTTOM_NAV_TABS,
  TAB_LABELS,
  tabHrefForRole,
  canAccessTab,
  canIssueInvite,
  canManageSettings,
  canManageUsers,
  type TabKey,
} from "@/lib/permissions";
import { TAB_ICONS } from "@/components/tabIcons";
import { useSession } from "@/lib/session-context";
import { GuardedLink } from "@/components/GuardedLink";
import { createClient } from "@/lib/supabase/client";
import {
  SettingsIcon,
  SwitchIcon,
  UserPlusIcon,
  UsersIcon,
  BuildingIcon,
  CardIcon,
  LogoutIcon,
} from "@/components/icons";

type SidebarIcon = (props: { className?: string }) => React.ReactElement;

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 mt-3 mb-0.5 text-[10px] font-bold tracking-wide text-ink-soft/70">{children}</div>;
}

function SidebarLink({ href, label, icon: Icon, active = false }: { href: string; label: string; icon: SidebarIcon; active?: boolean }) {
  return (
    <GuardedLink
      href={href}
      className={`flex min-h-tap items-center gap-2 px-2.5 rounded-lg text-[12px] font-bold ${
        active ? "bg-orange/10 text-orange-text" : "text-ink-soft"
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
    </GuardedLink>
  );
}

// タブレット幅(min-[700px]以上)では常時この左ナビが出るため、スマホ幅専用の
// ハンバーガーメニュー(NavDrawer)は入口として重複・不要になる(AppHeader側で
// min-[700px]:hiddenにして隠している)。そのためNavDrawerに入っていた
// アカウント・チーム運営・ログアウトの項目も、ここに同じ内容で持たせる。
export function Sidebar({ role, badges = {} }: { role: Role; badges?: Partial<Record<TabKey, boolean>> }) {
  const pathname = usePathname();
  const router = useRouter();
  const { teamName, teamLogoUrl, hasMultipleTeams } = useSession();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // NavDrawer.tsxと同じ出し分けロジック。
  const canShowInvite = canIssueInvite(role) && canAccessTab(role, "users");
  const canShowUserManagement = canManageUsers(role);
  const canShowTeamSettings = canManageSettings(role);

  return (
    <nav
      className="hidden min-[700px]:flex h-full flex-col w-[145px] flex-shrink-0 border-r border-line bg-white px-2 overflow-y-auto"
      // 上下ともenv(safe-area-inset-*)を足し、ステータスバー・ホームインジケーターの
      // 裏にロゴやログアウトボタンが隠れない・背景の白が物理的な下端まで続くようにする
      // (AppHeaderが右側のメインコンテンツに対して行っているのと同じ考え方)。
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 1rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
      }}
    >
      <div className="flex items-center gap-1.5 px-1.5 mb-4">
        {teamLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={teamLogoUrl} alt="" className="w-6 h-6 rounded object-contain bg-paper flex-shrink-0" />
        )}
        <span className="font-display font-bold text-[13px] text-ink truncate">{teamName}</span>
      </div>

      <div className="flex flex-col gap-1">
        {BOTTOM_NAV_TABS.map((tab) => {
          const Icon = TAB_ICONS[tab];
          const href = tabHrefForRole(role, tab);
          const isActive = pathname === href || pathname.startsWith(href + "/");
          const className = `flex min-h-tap items-center gap-2 px-2.5 rounded-lg text-[12px] font-bold ${
            isActive ? "bg-orange/10 text-orange-text" : "text-ink-soft"
          }`;
          return (
            <GuardedLink key={tab} href={href} className={className}>
              <span className="relative inline-flex flex-shrink-0">
                <Icon className="w-4 h-4" />
                {badges[tab] && (
                  <span className="absolute -top-0.5 -right-0.5 w-[6px] h-[6px] rounded-full bg-danger border border-white" />
                )}
              </span>
              {TAB_LABELS[tab]}
            </GuardedLink>
          );
        })}
      </div>

      <div className="border-t border-line mt-3 mb-1.5" />

      <SidebarLabel>アカウント</SidebarLabel>
      <div className="flex flex-col gap-1">
        {/* 「通知の受け取り」は/settings内の項目で遷移先が自分の設定と同じため、
            ここでは1行にまとめる。 */}
        <SidebarLink href="/settings" label="自分の設定" icon={SettingsIcon} />
        {hasMultipleTeams && <SidebarLink href="/select-team" label="チームを切り替える" icon={SwitchIcon} />}
      </div>

      {(canShowInvite || canShowUserManagement || canShowTeamSettings) && (
        <>
          <div className="border-t border-line mt-3 mb-1.5" />
          <SidebarLabel>チーム運営</SidebarLabel>
          <div className="flex flex-col gap-1">
            {canShowInvite && <SidebarLink href="/users" label="メンバーを招待" icon={UserPlusIcon} />}
            {canShowUserManagement && <SidebarLink href="/users" label="ユーザー管理" icon={UsersIcon} />}
            {canShowTeamSettings && (
              <>
                <SidebarLink href="/settings/team" label="チーム設定" icon={BuildingIcon} />
                <SidebarLink href="/settings/plan" label="プラン・お支払い" icon={CardIcon} />
              </>
            )}
          </div>
        </>
      )}

      <div className="flex-1 min-h-3" />

      <div className="border-t border-line pt-2 mt-2">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex min-h-tap items-center gap-2 px-2.5 rounded-lg text-[12px] font-bold text-danger-text"
        >
          <LogoutIcon className="w-4 h-4 flex-shrink-0" />
          {loggingOut ? "処理中…" : "ログアウト"}
        </button>
      </div>
    </nav>
  );
}
