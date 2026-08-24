import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthHeading } from "../AuthHeading";
import { SetupForm } from "./SetupForm";
import { ActiveTeamErrorScreen } from "@/components/ActiveTeamErrorScreen";

export default async function SetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    // profileはあるがteam_membershipsが無い異常状態では/scheduleへ戻さない
    // ((app)/layout.tsxのno_membership → /setupとの無限redirectループを防ぐ)。
    // team_membershipsはRLS policy 0件のため直接SELECTでは見えず、
    // 段階3a-2で追加済みのlist_my_team_memberships()(auth.uid()本人の
    // 所属一覧を返す読み取り専用RPC)を使う。RPC失敗とmembership 0件は
    // 区別し、同一扱いにしない。
    const { data: memberships, error: membershipsError } = await supabase.rpc("list_my_team_memberships");

    if (membershipsError) {
      console.error("list_my_team_memberships failed", membershipsError);
      return <ActiveTeamErrorScreen />;
    }

    if (memberships && memberships.length > 0) {
      redirect("/schedule");
    }

    return (
      <ActiveTeamErrorScreen
        title="所属チームが見つかりません"
        message="現在、所属チームを確認できません。お手数ですが運営までご連絡いただくか、ログインし直してお試しください。"
      />
    );
  }

  return (
    <div>
      <AuthHeading />
      <SetupForm />
    </div>
  );
}
