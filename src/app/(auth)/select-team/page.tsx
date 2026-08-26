import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthHeading } from "../AuthHeading";
import { ActiveTeamErrorScreen } from "@/components/ActiveTeamErrorScreen";
import { SelectTeamList } from "./SelectTeamList";
import { selectTeam } from "./actions";

// (app)/layout.tsxのinitialize_active_team()がneeds_selection(このsessionに
// まだactive teamが選ばれていない、かつ複数membershipを持つ)を返した際に
// 遷移してくる画面。current_team_id()/current_role()には一切依存せず、
// list_my_team_memberships()(auth.uid()本人の所属一覧、session状態と無関係)
// とswitch_active_team()(session_idキーのactive_team_sessionsをUPSERT)だけで
// 完結する。(app) layoutのbootstrap処理を経由しないため、リダイレクトループは
// 発生しない。
export default async function SelectTeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships, error } = await supabase.rpc("list_my_team_memberships");
  if (error) {
    console.error("list_my_team_memberships failed", error);
    return <ActiveTeamErrorScreen />;
  }

  if (!memberships || memberships.length === 0) {
    // 通常はinitialize_active_team()自体がno_membershipを先に返すため到達しない。
    // 直接URLアクセス等の異常系のフェイルセーフとしてsetupへ誘導する。
    redirect("/setup");
  }

  if (memberships.length === 1) {
    // 通常はinitialize_active_team()が1件のmembershipを自動解決するため到達しない。
    // 直接URLアクセス等の異常系のフェイルセーフとして、選ばせる意味がないので
    // そのままswitch_active_team()して/scheduleへ進める。
    const result = await selectTeam(memberships[0].team_id);
    if (result?.error) {
      console.error("switch_active_team failed (auto-select)", result.error);
      return <ActiveTeamErrorScreen />;
    }
    return null;
  }

  return (
    <div>
      <AuthHeading />
      <div className="text-center text-[13px] text-ink-soft mb-4">
        所属しているチームが複数あります。使用するチームを選択してください。
      </div>
      <SelectTeamList memberships={memberships} />
    </div>
  );
}
