import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthHeading } from "../AuthHeading";
import { SignupForm } from "./SignupForm";

export default async function SignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // 既存/新規の判定は、profilesへの直接SELECT(RLSのteam_id = current_team_id()
    // 経由で可視性が決まり、session未bootstrap時は自分のprofileすら見えなくなる)ではなく、
    // auth.uid()本人の所属一覧を返す読み取り専用RPC(list_my_team_memberships())で行う
    // (/setupの前提修正3と同じ理由)。RPC失敗は正常な0件と区別してログに残す。
    // エラー画面は/setup側の既存実装に委ね、ここでは重複実装しない。
    const { data: memberships, error: membershipsError } = await supabase.rpc("list_my_team_memberships");

    if (membershipsError) {
      console.error("list_my_team_memberships failed on signup", membershipsError);
      redirect("/setup");
    }

    redirect(memberships && memberships.length > 0 ? "/home" : "/setup");
  }

  return (
    <div>
      <AuthHeading />
      <SignupForm />
    </div>
  );
}
