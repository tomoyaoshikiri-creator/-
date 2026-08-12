import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SessionProvider, type SessionInfo } from "@/lib/session-context";
import { NavigationGuardProvider } from "@/lib/navigationGuard";
import { ToastProvider } from "@/components/ui/Toast";
import { TabBar } from "@/components/TabBar";
import { Sidebar } from "@/components/Sidebar";
import { InactivityLogout } from "@/components/InactivityLogout";
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
    .select("id, team_id, name, role, status, teams(name, theme_primary, theme_accent, logo_path)")
    .eq("id", session.user.id)
    .single<{
      id: string;
      team_id: string;
      name: string;
      role: SessionInfo["role"];
      status: string;
      teams: { name: string; theme_primary: string | null; theme_accent: string | null; logo_path: string | null } | null;
    }>();

  if (!profile) redirect("/setup");

  const team = profile.teams;

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
        }}
      >
        <ToastProvider>
          <NavigationGuardProvider>
            <InactivityLogout />
            <div className="flex-1 flex min-[700px]:flex-row flex-col min-h-0">
              <Sidebar role={profile.role} />
              <div className="flex-1 flex flex-col min-h-0 relative">{children}</div>
            </div>
            <TabBar role={profile.role} />
          </NavigationGuardProvider>
        </ToastProvider>
      </SessionProvider>
    </div>
  );
}
