import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SessionProvider, type SessionInfo } from "@/lib/session-context";
import { NavigationGuardProvider } from "@/lib/navigationGuard";
import { ToastProvider } from "@/components/ui/Toast";
import { AppNav } from "@/components/AppNav";
import { InactivityLogout } from "@/components/InactivityLogout";
import { TeamDeletionScreen } from "@/components/TeamDeletionScreen";
import { teamLogoUrl } from "@/lib/teamLogo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  // ここでの認証チェックはmiddleware(supabase.auth.getUser()でサーバーに問い合わせ済み)の
  // 二重チェック目的なので、Cookieのセッションをそのまま読むgetSession()で十分
  // (ネットワーク往復が発生せず高速)。profile/teamはFK経由の1クエリにまとめて往復回数を減らす。
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, team_id, name, role, status, teams(name, theme_primary, theme_accent, logo_path, plan, sport, deletion_requested_at)",
    )
    .eq("id", session.user.id)
    .single<{
      id: string;
      team_id: string;
      name: string;
      role: SessionInfo["role"];
      status: string;
      teams: {
        name: string;
        theme_primary: string | null;
        theme_accent: string | null;
        logo_path: string | null;
        plan: SessionInfo["plan"];
        sport: SessionInfo["sport"];
        deletion_requested_at: string | null;
      } | null;
    }>();

  if (!profile) redirect("/setup");

  const team = profile.teams;

  if (team?.deletion_requested_at) {
    const scheduledDeletionAt = new Date(team.deletion_requested_at);
    scheduledDeletionAt.setDate(scheduledDeletionAt.getDate() + 7);
    return (
      <TeamDeletionScreen
        isAdmin={profile.role === "管理者"}
        scheduledDeletionAt={scheduledDeletionAt.toISOString()}
      />
    );
  }

  // 「基調色」はヘッダー・タブなど画面全体で使われる --orange、
  // 「アクセントカラー」は詳細画面ヘッダーやボタンで使われる --navy に対応させる。
  const themeStyle: Record<string, string> = {};
  if (team?.theme_primary) themeStyle["--orange"] = team.theme_primary;
  if (team?.theme_accent) themeStyle["--navy"] = team.theme_accent;

  return (
    <div className="app-shell" style={themeStyle as React.CSSProperties}>
      <SessionProvider
        value={{
          userId: profile.id,
          teamId: profile.team_id,
          teamName: team?.name ?? "",
          teamLogoUrl: teamLogoUrl(supabase, team?.logo_path),
          name: profile.name,
          role: profile.role,
          plan: team?.plan ?? "お試し",
          sport: team?.sport ?? "ミニバスケットボール",
        }}
      >
        <ToastProvider>
          <NavigationGuardProvider>
            <InactivityLogout />
            <AppNav role={profile.role}>{children}</AppNav>
          </NavigationGuardProvider>
        </ToastProvider>
      </SessionProvider>
    </div>
  );
}
