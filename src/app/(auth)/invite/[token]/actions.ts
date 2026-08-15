"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/origin";

export interface FormState {
  error?: string;
  message?: string;
}

export async function acceptInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const sei = String(formData.get("sei") ?? "").trim();
  const mei = String(formData.get("mei") ?? "").trim();
  const name = `${sei}${mei}`;
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!token || !sei || !mei || !email || !password) {
    return { error: "すべての項目を入力してください" };
  }
  if (password.length < 8) {
    return { error: "パスワードは8文字以上で入力してください" };
  }

  const origin = await getRequestOrigin();
  const completeParams = new URLSearchParams({ kind: "invite", token, name });
  const next = `/auth/complete?${completeParams.toString()}`;
  const emailRedirectTo = `${origin}/auth/confirm?next=${encodeURIComponent(next)}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });
  if (error) return { error: error.message };
  if (!data.user) return { error: "アカウントの作成に失敗しました" };

  if (!data.session) {
    return {
      message: "確認メールを送信しました。メール内のリンクを開いて認証を完了してください。",
    };
  }

  const { error: rpcError } = await supabase.rpc("accept_invite", {
    invite_token: token,
    member_name: name,
  });
  if (rpcError) return { error: rpcError.message };

  redirect("/schedule");
}
