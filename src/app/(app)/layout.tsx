import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SessionProvider } from "@/lib/session-context";
import { ToastProvider } from "@/components/ui/Toast";
import { TabBar } from "@/components/TabBar";
import { InactivityLogout } from "@/components/InactivityLogout";
import { teamLogoUrl } from "@/lib/teamLogo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, team_id, name, role, status")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/setup");

  const { data: team } = await supabase
    .from("teams")
    .select("name, theme_primary, theme_accent, logo_path")
    .eq("id", profile.team_id)
    .single();

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
          <InactivityLogout />
          <div className="flex-1 flex flex-col min-h-0 relative">{children}</div>
          <TabBar role={profile.role} />
        </ToastProvider>
      </SessionProvider>
    </div>
  );
}
