import { logError } from "@/lib/logger";

// Cloudflare Turnstile(CAPTCHA)のサーバー側検証。TURNSTILE_SECRET_KEY未設定の
// 環境(このリポジトリのデフォルト状態)では呼び出し元がそもそもこの関数を使わない
// (鍵の取得・設定自体は人間対応、C-2参照)。
export async function verifyTurnstileToken(token: string, secretKey: string): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    logError("[turnstile] verify request failed", err);
    return false;
  }
}
