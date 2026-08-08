"use server";

import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/origin";

export interface FormState {
  error?: string;
  message?: string;
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "メールアドレスを入力してください" };
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
