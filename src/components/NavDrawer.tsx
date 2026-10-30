"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { GuardedLink } from "@/components/GuardedLink";
import {
  BOTTOM_NAV_TABS,
  TAB_LABELS,
  tabHrefForRole,
  canAccessTab,
  canIssueInvite,
  canManageSettings,
  canManageUsers,
} from "@/lib/permissions";
import { TAB_ICONS } from "@/components/tabIcons";
import {
  CloseIcon,
  SettingsIcon,
  BellIcon,
  SwitchIcon,
  UserPlusIcon,
  UsersIcon,
  BuildingIcon,
  CardIcon,
  LogoutIcon,
} from "@/components/icons";

type DrawerIcon = (props: { className?: string }) => React.ReactElement;

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <div className="mx-3.5 mt-2 mb-1 text-[11px] font-bold tracking-wide text-ink-soft/70">{label}</div>
      {children}
    </div>
  );
}

function DrawerLink({
  href,
  label,
  icon: Icon,
  active = false,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: DrawerIcon;
  active?: boolean;
  onNavigate: () => void;
}) {
  return (
    <GuardedLink
      href={href}
      onClick={onNavigate}
      className={`flex min-h-tap items-center gap-3 px-3.5 text-[14px] ${
        active ? "bg-orange/10 text-orange-text font-bold" : "text-ink"
      }`}
    >
      <Icon className="w-[19px] h-[19px] flex-shrink-0" />
      {label}
    </GuardedLink>
  );
}

// ハンバーガーメニューから開く左側ドロワー。下部タブと同じ5項目(複数入口化)と、
// 従来CurrentUserBadgeのドロップダウンに入っていたアカウント・チーム運営関連の項目を
// ここに集約する(名前タップ型のメニューが気づかれにくいという意見への対応)。
export function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { role, hasMultipleTeams, teamName, teamLogoUrl } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // CurrentUserBadgeのドロップダウンにあった出し分けロジックをそのまま移植。
  const canShowInvite = canIssueInvite(role) && canAccessTab(role, "users");
  const canShowUserManagement = canManageUsers(role);
  const canShowTeamSettings = canManageSettings(role);

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="メニュー">
      <div className="absolute inset-0 bg-heading/55" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="absolute left-0 top-0 h-full w-[62%] max-w-[280px] bg-white shadow-xl flex flex-col outline-none overflow-y-auto"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between px-3.5 pt-3 pb-1">
          <button
            type="button"
            onClick={onClose}
            aria-label="メニューを閉じる"
            className="min-w-tap min-h-tap rounded-lg flex items-center justify-center bg-paper text-ink-soft"
          >
            <CloseIcon className="w-[18px] h-[18px]" />
          </button>
        </div>

        <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-line">
          {teamLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={teamLogoUrl} alt="" className="w-8 h-8 rounded object-contain flex-shrink-0" />
          )}
          <span className="font-bold text-[15px] text-ink truncate">{teamName}</span>
        </div>

        <Section label="メニュー">
          {BOTTOM_NAV_TABS.map((tab) => {
            const href = tabHrefForRole(role, tab);
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <DrawerLink
                key={tab}
                href={href}
                label={TAB_LABELS[tab]}
                icon={TAB_ICONS[tab]}
                active={isActive}
                onNavigate={onClose}
              />
            );
          })}
        </Section>

        <div className="border-t border-line" />

        <Section label="アカウント">
          <DrawerLink href="/settings" label="設定" icon={SettingsIcon} onNavigate={onClose} />
          <DrawerLink href="/settings" label="通知の受け取り" icon={BellIcon} onNavigate={onClose} />
          {hasMultipleTeams && (
            <DrawerLink href="/select-team" label="チームを切り替える" icon={SwitchIcon} onNavigate={onClose} />
          )}
        </Section>

        {(canShowInvite || canShowUserManagement || canShowTeamSettings) && (
          <>
            <div className="border-t border-line" />
            <Section label="チーム運営">
              {canShowInvite && (
                <DrawerLink href="/users" label="メンバーを招待" icon={UserPlusIcon} onNavigate={onClose} />
              )}
              {canShowUserManagement && (
                <DrawerLink href="/users" label="ユーザー管理" icon={UsersIcon} onNavigate={onClose} />
              )}
              {canShowTeamSettings && (
                <>
                  <DrawerLink href="/settings/team" label="チーム設定" icon={BuildingIcon} onNavigate={onClose} />
                  <DrawerLink href="/settings/plan" label="プラン・お支払い" icon={CardIcon} onNavigate={onClose} />
                </>
              )}
            </Section>
          </>
        )}

        <div className="flex-1" />

        <div className="border-t border-line">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-3 px-3.5 py-3 text-[14px] font-bold text-danger-text"
          >
            <LogoutIcon className="w-[19px] h-[19px] flex-shrink-0" />
            {loggingOut ? "処理中…" : "ログアウト"}
          </button>
        </div>
      </div>
    </div>
  );
}
