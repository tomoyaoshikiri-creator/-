"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/origin";

export interface FormState {
  error?: string;
  message?: string;
}

// チーム名・氏名・競技等はここでは聞かず、メール確認後に/setup(既存の
// 「チーム未作成」フォーム)でまとめて1回だけ入力してもらう。以前は
// emailRedirectToの?next=...にチーム名等を埋め込み、確認メールのリンクを
// 経由して自動でチームを作成していたが、その受け渡しが機能しないケースがあり、
// 結果として/setupで同じ項目を再入力させることになっていたため撤廃した。
export async function signUpTeam(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください" };
  }
  if (password.length < 8) {
    return { error: "パスワードは8文字以上で入力してください" };
  }

  const origin = await getRequestOrigin();
  const emailRedirectTo = `${origin}/auth/confirm?next=${encodeURIComponent("/setup")}`;

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

  redirect("/setup");
}
