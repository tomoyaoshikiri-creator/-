"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface FormState {
  error?: string;
}

// メール確認や通信断などで「アカウントはあるがチーム作成が完了しなかった」ユーザーが
// 再度チーム名・管理者名を入力してセットアップを完了するための専用アクション。
// signUp() は行わず、既存セッションに対して create_team_and_admin RPC だけを実行する。
export async function completeSetup(_prev: FormState, formData: FormData): Promise<FormState> {
  const teamName = String(formData.get("teamName") ?? "").trim();
  const adminName = String(formData.get("adminName") ?? "").trim();

  if (!teamName || !adminName) {
    return { error: "すべての項目を入力してください" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("create_team_and_admin", {
    team_name: teamName,
    admin_name: adminName,
  });
  if (error) return { error: error.message };

  redirect("/schedule");
}
