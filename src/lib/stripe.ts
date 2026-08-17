import Stripe from "stripe";
import type { TeamPlan } from "@/lib/database.types";

// 鍵未設定の環境(このリポジトリのデフォルト状態)ではnullを返すだけにして、
// 呼び出し元(課金関連のRoute Handler)がそれぞれ「未設定です」を返せるようにする
// (Web Pushの実装と同じ考え方)。
export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return new Stripe(secretKey);
}

// 有料プラン(中間・フル)とStripe Price IDの対応。お試しプランはStripe側に何も作らない
// (無料なのでサブスクリプション自体が存在しない)。
export const PAID_PLAN_PRICE_ENV: Record<"中間" | "フル", string> = {
  中間: "STRIPE_PRICE_ID_MIDDLE",
  フル: "STRIPE_PRICE_ID_FULL",
};

export function priceIdForPlan(plan: "中間" | "フル"): string | null {
  return process.env[PAID_PLAN_PRICE_ENV[plan]] || null;
}

export function planForPriceId(priceId: string | null | undefined): TeamPlan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ID_MIDDLE) return "中間";
  if (priceId === process.env.STRIPE_PRICE_ID_FULL) return "フル";
  return null;
}
