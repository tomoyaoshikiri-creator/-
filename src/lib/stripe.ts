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

export type BillingInterval = "monthly" | "yearly";
export type PaidPlan = "中間" | "フル" | "フルプラス";

// 有料プラン(中間・フル・フルプラス)とStripe Price IDの対応。月払い・年払い(10%オフ)の
// 2種類のPriceを同じプランに紐づける。お試しプランはStripe側に何も作らない
// (無料なのでサブスクリプション自体が存在しない)。
export const PAID_PLAN_PRICE_ENV: Record<PaidPlan, Record<BillingInterval, string>> = {
  中間: { monthly: "STRIPE_PRICE_ID_MIDDLE", yearly: "STRIPE_PRICE_ID_MIDDLE_YEARLY" },
  フル: { monthly: "STRIPE_PRICE_ID_FULL", yearly: "STRIPE_PRICE_ID_FULL_YEARLY" },
  フルプラス: { monthly: "STRIPE_PRICE_ID_PRO_PLUS", yearly: "STRIPE_PRICE_ID_PRO_PLUS_YEARLY" },
};

export function priceIdForPlan(plan: PaidPlan, interval: BillingInterval = "monthly"): string | null {
  return process.env[PAID_PLAN_PRICE_ENV[plan][interval]] || null;
}

// 月払い・年払いのどちらのPrice IDでも同じプランとして解決する(teams.planは
// 契約期間を区別しないため、課金サイクルの違いはStripe側のSubscriptionにのみ残る)。
export function planForPriceId(priceId: string | null | undefined): TeamPlan | null {
  if (!priceId) return null;
  for (const plan of Object.keys(PAID_PLAN_PRICE_ENV) as PaidPlan[]) {
    const envKeys = PAID_PLAN_PRICE_ENV[plan];
    if (priceId === process.env[envKeys.monthly] || priceId === process.env[envKeys.yearly]) {
      return plan;
    }
  }
  return null;
}
