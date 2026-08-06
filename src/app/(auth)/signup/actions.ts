"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface FormState {
  error?: string;
  message?: string;
}

export async function signUpTeam(_prev: FormState, formData: FormData): Promise<FormState> {
  const teamName = String(formData.get("teamName") ?? "").trim();
  const adminName = String(formData.get("adminName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!teamName || !adminName || !email || !password) {
    return { error: "すべての項目を入力してください" };
  }
  if (password.length < 8) {
    return { error: "パスワードは8文字以上で入力してください" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  if (!data.user) return { error: "アカウントの作成に失敗しました" };

  if (!data.session) {
    return {
      message: "確認メールを送信しました。メール内のリンクを開いて認証を完了してください。",
    };
  }

  const { error: rpcError } = await supabase.rpc("create_team_and_admin", {
    team_name: teamName,
    admin_name: adminName,
  });
  if (rpcError) return { error: rpcError.message };

  redirect("/schedule");
}
