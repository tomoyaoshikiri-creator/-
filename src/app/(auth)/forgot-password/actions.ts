"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/origin";
import { getClientIp } from "@/lib/clientIp";
import { checkRateLimit } from "@/lib/rateLimit";

export interface FormState {
  error?: string;
  message?: string;
  // メール確認待ち(確認コード入力)の状態に入っているかどうか。trueの間は
  // ForgotPasswordFormがコード入力フォームを表示し続ける(email保持のため必須)。
  awaitingCode?: boolean;
  email?: string;
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "メールアドレスを入力してください" };
  }

  const clientIp = await getClientIp();
  const allowed = await checkRateLimit({
    eventType: "forgot_password",
    key: clientIp,
    windowSeconds: 600,
    maxCount: 10,
  });
  if (!allowed) {
    return { error: "リクエストが多すぎます。しばらく時間をおいてから再度お試しください。" };
  }

  const origin = await getRequestOrigin();
  const next = "/reset-password";
  const redirectTo = `${origin}/auth/confirm?next=${encodeURIComponent(next)}`;

  const supabase = await createClient();
  // メールアドレスの存在有無を外部に漏らさないため、成功・失敗によらず同じ案内を返す。
  await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  return {
    message:
      "入力されたメールアドレス宛にパスワード再設定用のコードを送信しました。メールに記載の6桁のコードを入力してください。",
    awaitingCode: true,
    email,
  };
}

// メール内のリンクではなく、メールに記載された6桁の確認コードをその場で入力して
// 完了させる経路(ネイティブアプリ化時のディープリンク依存を避けるため)。
// リンク経由(/auth/confirm→/reset-password)も引き続き有効なまま残しており、
// どちらか先着した方でセッションが確立される(両方試しても2回目はコード/リンクが
// 無効というエラーになるだけで無害)。
export async function verifyResetCode(prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? prev.email ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  if (!code) {
    return { awaitingCode: true, email, error: "確認コードを入力してください" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
  if (error) {
    return { awaitingCode: true, email, error: "コードが正しくないか、有効期限が切れています" };
  }

  redirect("/reset-password");
}

// resend()はrecoveryタイプに対応していない(型上signup/email_change/sms/phone_changeの
// みが対象)ため、resetPasswordForEmail()を再度呼び出すことでコードを再送する。
export async function resendResetCode(prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? prev.email ?? "").trim();

  const origin = await getRequestOrigin();
  const next = "/reset-password";
  const redirectTo = `${origin}/auth/confirm?next=${encodeURIComponent(next)}`;

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  return { awaitingCode: true, email, message: "確認コードを再送しました。" };
}
