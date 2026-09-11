"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/origin";
import { getClientIp } from "@/lib/clientIp";
import { checkRateLimit } from "@/lib/rateLimit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { CURRENT_TERMS_VERSION } from "@/lib/legal";

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
  if (!formData.get("agreedTerms")) {
    return { error: "利用規約とプライバシーポリシーへの同意が必要です" };
  }

  const clientIp = await getClientIp();
  const allowed = await checkRateLimit({ eventType: "signup", key: clientIp, windowSeconds: 600, maxCount: 10 });
  if (!allowed) {
    return { error: "リクエストが多すぎます。しばらく時間をおいてから再度お試しください。" };
  }

  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    const token = String(formData.get("cf-turnstile-response") ?? "");
    const verified = await verifyTurnstileToken(token, turnstileSecret);
    if (!verified) {
      return { error: "認証に失敗しました。もう一度お試しください。" };
    }
  }

  const origin = await getRequestOrigin();
  const emailRedirectTo = `${origin}/auth/confirm?next=${encodeURIComponent("/setup")}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      // profilesはこの時点では未作成(/setupで作成)のため、同意記録は
      // まずauth.usersのuser_metadataに載せる(email確認の有無に関わらず
      // signUp()呼び出しと同時に確定するため、/setupへの遷移経路に依存しない)。
      // profiles側への実際の記録は/setup(completeSetup)で改めて行う。
      data: { agreed_terms_version: CURRENT_TERMS_VERSION, agreed_terms_at: new Date().toISOString() },
    },
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
