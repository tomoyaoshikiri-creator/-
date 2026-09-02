"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { GuardedLink } from "@/components/GuardedLink";
import { canAccessTab, canIssueInvite, canManageSettings, canManageUsers } from "@/lib/permissions";

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3.5 pt-2.5 pb-1 text-[10px] font-bold tracking-wide text-ink-soft/70 first:pt-2">
      {children}
    </div>
  );
}

function MenuItem({ href, label, onNavigate }: { href: string; label: string; onNavigate: () => void }) {
  return (
    <GuardedLink
      href={href}
      onClick={onNavigate}
      className="block w-full text-left px-3.5 py-2.5 text-[12.5px] font-bold text-ink"
    >
      {label}
    </GuardedLink>
  );
}

export function CurrentUserBadge() {
  const { name, role, hasMultipleTeams } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // 「メンバーを招待」の遷移先(/users)は、既存のROLE_TABS上まだ指導者がアクセスできない
  // (usersタブを持つのは運営・管理者のみ)。canIssueInvite単独では指導者にもリンクが
  // 見えてしまい、タップすると/schedule へ弾かれる壊れたリンクになるため、
  // 実際に/usersへ到達できるロール(canAccessTab)でも同時に絞る。
  const canShowInvite = canIssueInvite(role) && canAccessTab(role, "users");
  const canShowUserManagement = canManageUsers(role);
  const canShowTeamSettings = canManageSettings(role);

  function close() {
    setOpen(false);
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        // Phase UI-2B以前は名前1行のみ(text-xs font-bold, py-1.5)だった。role行を
        // 追加で表示する仕様は維持しつつ、Header全体の縦占有サイズを改修前相当に保つため、
        // pyを切り詰め(py-1.5→py-0.5)、両行ともleading-noneでline-heightを
        // font-sizeちょうどに固定する(role行を追加した分だけの最小限の増分に抑える)。
        className="flex flex-col items-end gap-0.5 max-w-[140px] px-2.5 py-0.5 rounded-lg"
        style={{ background: "var(--header-chip-surface)", color: "var(--header-chip-on)" }}
      >
        <span className="text-xs leading-none font-bold truncate max-w-full">{name}</span>
        <span className="text-[9px] leading-none font-medium opacity-80 truncate max-w-full">{role}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute right-0 top-full mt-1.5 bg-white rounded-lg shadow-lg z-20 min-w-[180px] overflow-hidden">
            {/* スマホでドロップダウンが画面外に出ないよう、パネル自体の角丸はそのままに
                中身だけを最大高+内部スクロールにする。 */}
            <div className="max-h-[70vh] overflow-y-auto">
              <MenuLabel>アカウント</MenuLabel>
              <MenuItem href="/settings" label="自分の設定" onNavigate={close} />
              <MenuItem href="/settings" label="通知の受け取り" onNavigate={close} />
              {hasMultipleTeams && <MenuItem href="/select-team" label="チームを切り替える" onNavigate={close} />}

              {(canShowInvite || canShowUserManagement || canShowTeamSettings) && (
                <>
                  <div className="border-t border-line" />
                  <MenuLabel>チーム運営</MenuLabel>
                  {canShowInvite && <MenuItem href="/users" label="メンバーを招待" onNavigate={close} />}
                  {canShowUserManagement && <MenuItem href="/users" label="ユーザー管理" onNavigate={close} />}
                  {canShowTeamSettings && (
                    <>
                      <MenuItem href="/settings" label="チーム設定" onNavigate={close} />
                      <MenuItem href="/settings/plan" label="プラン・お支払い" onNavigate={close} />
                    </>
                  )}
                </>
              )}

              <div className="border-t border-line" />
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full text-left px-3.5 py-2.5 text-[12.5px] font-bold text-danger"
              >
                {loggingOut ? "処理中…" : "ログアウト"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
