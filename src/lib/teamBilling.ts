import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_CONFIG } from "@/lib/plan";
import { logError } from "@/lib/logger";
import type { Database, TeamPlan } from "@/lib/database.types";

export type BillingPlatform = "stripe" | "apple" | "google";
export type BillingSubscriptionStatus = "active" | "canceled";
// team_billing_subscriptions.planが取りうる値(セルフチェックアウト可能なプランのみ。
// Max/Max Partner/Signature Editionのような手動付与プランはここに乗らない)。
export type SelfCheckoutPlan = "お試し" | "中間" | "フル" | "フルプラス";

// iOS・Android・Webのどこで契約しても同じteams.planに反映されるようにするための
// 共通処理(ユーザー指示 項目4)。teams.planは今まで通り「実際に有効な権限」を表す
// 唯一の真実のまま残し、team_billing_subscriptionsに「どの決済経路からの契約が
// 今有効か」を記録したうえで、その中から一番上のプランをteams.planへ反映する。
//
// Max/Max Partner/Signature Editionのような手動付与プラン(運営が個別に付与し、
// Stripe/Apple/Googleいずれの課金にも紐付かない)は対象外で、絶対に書き換えない
// (万one誤って呼び出されても安全なよう、ここでガードする)。
const SELF_CHECKOUT_PLANS: SelfCheckoutPlan[] = ["中間", "フル", "フルプラス"];

export async function upsertBillingSubscription(
  adminClient: SupabaseClient<Database>,
  params: {
    teamId: string;
    platform: BillingPlatform;
    externalSubscriptionId: string;
    plan: SelfCheckoutPlan;
    status: BillingSubscriptionStatus;
    currentPeriodEnd?: string | null;
  },
): Promise<boolean> {
  const { error } = await adminClient.from("team_billing_subscriptions").upsert(
    {
      team_id: params.teamId,
      platform: params.platform,
      external_subscription_id: params.externalSubscriptionId,
      plan: params.plan,
      status: params.status,
      current_period_end: params.currentPeriodEnd ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "platform,external_subscription_id" },
  );
  if (error) {
    logError(`[teamBilling] failed to upsert subscription (${params.platform}/${params.externalSubscriptionId})`, error);
    return false;
  }
  return true;
}

// そのチームの有効な契約(team_billing_subscriptions.status = 'active')を
// 全プラットフォーム分見て、一番上のプランをteams.planへ反映する。有効な契約が
// 1件もなければ「お試し」に戻す(現状のStripe customer.subscription.deleted時の
// 挙動と同じ)。
export async function recomputeTeamPlan(adminClient: SupabaseClient<Database>, teamId: string): Promise<TeamPlan | null> {
  const { data: team, error: teamError } = await adminClient.from("teams").select("plan").eq("id", teamId).single();
  if (teamError || !team) {
    logError(`[teamBilling] failed to load team for recompute (${teamId})`, teamError);
    return null;
  }
  if (team.plan !== "お試し" && !SELF_CHECKOUT_PLANS.includes(team.plan as SelfCheckoutPlan)) {
    // Max/Max Partner/Signature Edition等の手動付与プランには触れない。
    return team.plan as TeamPlan;
  }

  const { data: subs, error: subsError } = await adminClient
    .from("team_billing_subscriptions")
    .select("plan")
    .eq("team_id", teamId)
    .eq("status", "active");
  if (subsError) {
    logError(`[teamBilling] failed to load subscriptions for recompute (${teamId})`, subsError);
    return null;
  }

  const activePlans = (subs ?? [])
    .map((s) => s.plan as SelfCheckoutPlan)
    .filter((p) => SELF_CHECKOUT_PLANS.includes(p));
  const resolvedPlan: SelfCheckoutPlan =
    activePlans.length > 0
      ? activePlans.reduce((best, p) => (PLAN_CONFIG[p].tier > PLAN_CONFIG[best].tier ? p : best))
      : "お試し";

  const { error: updateError } = await adminClient.from("teams").update({ plan: resolvedPlan }).eq("id", teamId);
  if (updateError) {
    logError(`[teamBilling] failed to update team plan (${teamId})`, updateError);
    return null;
  }
  return resolvedPlan;
}
