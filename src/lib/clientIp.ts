import { headers } from "next/headers";

// Vercel等のプロキシ経由ではx-forwarded-forの先頭が実クライアントIP。
// ローカル開発等でヘッダーが無い場合は"unknown"にまとめ、レート制限のkeyとしては
// 同一視される(開発環境での連投防止は目的外のため許容)。
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}
