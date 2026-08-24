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

  // 新規/既存ユーザーの判定は、profilesへの直接SELECT(RLSのteam_id = current_team_id()
  // 経由で可視性が決まり、session未bootstrap時は自分のprofileすら見えなくなる)ではなく、
  // auth.uid()本人の所属一覧を返す読み取り専用RPC(list_my_team_memberships())だけで行う。
  // このRPCはcurrent_team_id()/current_role()に依存しないため、session状態に関わらず
  // 正しく判定できる。profilesとteam_membershipsは常に1:1で作成・削除される
  // (0107の同期trigger、team_memberships.user_idのON DELETE CASCADE)ため、
  // membership 0件は新規ユーザーと同義として扱ってよい。
  const { data: memberships, error: membershipsError } = await supabase.rpc("list_my_team_memberships");

  if (membershipsError) {
    console.error("list_my_team_memberships failed", membershipsError);
    return <ActiveTeamErrorScreen />;
  }

  if (memberships && memberships.length > 0) {
    redirect("/schedule");
  }

  return (
    <div>
      <AuthHeading />
      <SetupForm />
    </div>
  );
}
