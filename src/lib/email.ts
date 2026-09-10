import { Resend } from "resend";

// RESEND_API_KEY未設定の環境(このリポジトリのデフォルト状態)ではnullを返すだけにして、
// 呼び出し元がそれぞれ「未設定です」を返せるようにする(Web Push/Stripeの鍵と同じ考え方)。
export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export type SendEmailResult = { success: true; messageId?: string } | { success: false; error: string };

// RESEND_FROM_ADDRESSは送信ドメイン(Resend側でDNS認証済みである必要がある)込みの
// From値。未設定時は開発用の仮アドレスにフォールバックするが、実際に配送されるかは
// Resend側のドメイン設定次第(要人間確認)。
export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<SendEmailResult> {
  const resend = getResendClient();
  if (!resend) return { success: false, error: "RESEND_API_KEY is not configured" };

  const from = process.env.RESEND_FROM_ADDRESS || "CIRCLE LINES <onboarding@resend.dev>";
  try {
    const { data, error } = await resend.emails.send({ from, to: params.to, subject: params.subject, html: params.html });
    if (error) return { success: false, error: error.message };
    return { success: true, messageId: data?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
