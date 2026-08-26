import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SessionProvider, type SessionInfo } from "@/lib/session-context";
import { NavigationGuardProvider } from "@/lib/navigationGuard";
import { ToastProvider } from "@/components/ui/Toast";
import { AppNav } from "@/components/AppNav";
import { InactivityLogout } from "@/components/InactivityLogout";
import { TeamDeletionScreen } from "@/components/TeamDeletionScreen";
import { ActiveTeamErrorScreen } from "@/components/ActiveTeamErrorScreen";
import { teamLogoUrl } from "@/lib/teamLogo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  // ここでの認証チェックはmiddleware(supabase.auth.getUser()でサーバーに問い合わせ済み)の
  // 二重チェック目的なので、Cookieのセッションをそのまま読むgetSession()で十分
  // (ネットワーク往復が発生せず高速)。membership/team/profileは並列取得で往復回数を減らす。
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  // current_team_id()/current_role()に一切依存せず、auth.uid()/session_idだけを
  // 起点にactive teamを解決する(将来current_team_id()をactive_team_sessions依存へ
  // 切り替えた際も、新規sessionが自己初期化できるようにするための前段ステップ)。
  // このRPC自体はまだcurrent_team_id()の判定には使われない。
  const { data: bootstrap, error: bootstrapError } = await supabase.rpc("initialize_active_team").single();

  if (bootstrapError) {
    console.error("initialize_active_team failed", bootstrapError);
    return <ActiveTeamErrorScreen />;
  }

  if (bootstrap.status === "no_membership") redirect("/setup");
  // 段階3d-2: 複数チーム所属が実際に解禁されると、このsessionでまだactive team
  // が選択されていない場合にneeds_selectionが返る(正常なケース)。選択画面へ誘導する。
  if (bootstrap.status === "needs_selection") redirect("/select-team");

  // 現在チームの所属・role/statusはteam_membershipsが正本。team_membershipsはRLS有効・
  // policy 0件のため直接SELECTできず、読み取り専用RPC(list_my_team_memberships())経由で
  // 取得する。bootstrap.team_idと一致する行だけを採用する(該当なしは通常発生しない、
  // initialize_active_team()が直前に'resolved'を返しているため)。
  const [{ data: memberships, error: membershipsError }, { data: team }, { data: profile }] = await Promise.all([
    supabase.rpc("list_my_team_memberships"),
    supabase
      .from("teams")
      .select("name, theme_primary, theme_accent, logo_path, plan, sport, category, deletion_requested_at")
      .eq("id", bootstrap.team_id!)
      .single<{
        name: string;
        theme_primary: string | null;
        theme_accent: string | null;
        logo_path: string | null;
        plan: SessionInfo["plan"];
        sport: SessionInfo["sport"];
        category: SessionInfo["category"];
        deletion_requested_at: string | null;
      }>(),
    supabase.from("profiles").select("id, name").eq("id", session.user.id).single<{ id: string; name: string }>(),
  ]);

  if (membershipsError || !profile) {
    console.error("failed to load membership/profile", membershipsError);
    return <ActiveTeamErrorScreen />;
  }

  const membership = (memberships ?? []).find((m) => m.team_id === bootstrap.team_id);
  if (!membership) {
    console.error("no team_memberships row matches bootstrap.team_id");
    return <ActiveTeamErrorScreen />;
  }
  const role = membership.role as SessionInfo["role"];

  if (team?.deletion_requested_at) {
    const scheduledDeletionAt = new Date(team.deletion_requested_at);
    scheduledDeletionAt.setDate(scheduledDeletionAt.getDate() + 7);
    return (
      <TeamDeletionScreen
        isAdmin={role === "管理者"}
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
          teamId: bootstrap.team_id!,
          teamName: team?.name ?? "",
          teamLogoUrl: teamLogoUrl(supabase, team?.logo_path),
          name: profile.name,
          role,
          hasMultipleTeams: (memberships ?? []).length > 1,
          plan: team?.plan ?? "お試し",
          sport: team?.sport ?? "ミニバスケットボール",
          category: team?.category ?? "小学生",
        }}
      >
        <ToastProvider>
          <NavigationGuardProvider>
            <InactivityLogout />
            <AppNav role={role}>{children}</AppNav>
          </NavigationGuardProvider>
        </ToastProvider>
      </SessionProvider>
    </div>
  );
}
