"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/origin";
import { getClientIp } from "@/lib/clientIp";
import { checkRateLimit } from "@/lib/rateLimit";
import { verifyTurnstileToken } from "@/lib/turnstile";

export interface FormState {
  error?: string;
  message?: string;
  // メール確認待ち(確認コード入力)の状態に入っているかどうか。trueの間は
  // SignupFormがコード入力フォームを表示し続ける(email保持のため必須)。
  awaitingCode?: boolean;
  email?: string;
}

// チーム名・氏名・競技・利用規約への同意等はここでは聞かず、メール確認後に
// /setup(既存の「チーム未作成」フォーム)でまとめて1回だけ入力してもらう。
// 以前は emailRedirectTo の?next=...にチーム名等を埋め込み、確認メールの
// リンクを経由して自動でチームを作成していたが、その受け渡しが機能しない
// ケースがあり、結果として/setupで同じ項目を再入力させることになっていた
// ため撤廃した。同意チェックボックスも同じ理由でここでは表示せず、
// /setup(completeSetup)側の1回だけに統一している。
export async function signUpTeam(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください" };
  }
  if (password.length < 8) {
    return { error: "パスワードは8文字以上で入力してください" };
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
    },
  });
  if (error) return { error: error.message };
  if (!data.user) return { error: "アカウントの作成に失敗しました" };

  if (!data.session) {
    return {
      message: "確認メールを送信しました。メールに記載の6桁のコードを入力してください。",
      awaitingCode: true,
      email,
    };
  }

  redirect("/setup");
}

// メール内のリンクではなく、メールに記載された6桁の確認コードをその場で入力して
// 完了させる経路(ネイティブアプリ化時のディープリンク依存を避けるため)。
// リンク経由(/auth/confirm)も引き続き有効なまま残しており、どちらか先着した方で
// 確認が完了する(両方試しても2回目は「既に確認済み」エラーになるだけで無害)。
export async function verifySignupCode(prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? prev.email ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  if (!code) {
    return { awaitingCode: true, email, error: "確認コードを入力してください" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) {
    return { awaitingCode: true, email, error: "コードが正しくないか、有効期限が切れています" };
  }

  redirect("/setup");
}

export async function resendSignupCode(prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? prev.email ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) {
    return { awaitingCode: true, email, error: `再送に失敗しました: ${error.message}` };
  }
  return { awaitingCode: true, email, message: "確認コードを再送しました。" };
}
