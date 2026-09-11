"use server";

import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/origin";
import { getClientIp } from "@/lib/clientIp";
import { checkRateLimit } from "@/lib/rateLimit";

export interface FormState {
  error?: string;
  message?: string;
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
      "入力されたメールアドレス宛にパスワード再設定用のメールを送信しました。メール内のリンクから新しいパスワードを設定してください。",
  };
}
