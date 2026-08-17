import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { getStripeClient, planForPriceId } from "@/lib/stripe";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";

// Stripeからのサブスクリプション関連イベントを受け取り、teamsのplan/契約状態に反映する。
// 生ボディで署名検証する必要があるため request.text() を使う(request.json()は使わない)。
export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripe || !webhookSecret || !serviceRoleKey) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();
  if (!signature) {
    return NextResponse.json({ error: "signature missing" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[webhooks/stripe] signature verification failed", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const adminClient = createSupabaseJsClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  async function syncSubscription(subscription: Stripe.Subscription) {
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    const priceId = subscription.items.data[0]?.price.id ?? null;
    const plan = planForPriceId(priceId);
    if (!plan) {
      console.error(`[webhooks/stripe] unknown price id ${priceId} for customer ${customerId}`);
      return;
    }
    const { error } = await adminClient
      .from("teams")
      .update({ plan, stripe_subscription_id: subscription.id, subscription_status: subscription.status })
      .eq("stripe_customer_id", customerId);
    if (error) console.error("[webhooks/stripe] failed to sync subscription", error);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscription(subscription);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      const { error } = await adminClient
        .from("teams")
        .update({ plan: "お試し", stripe_subscription_id: null, subscription_status: "canceled" })
        .eq("stripe_customer_id", customerId);
      if (error) console.error("[webhooks/stripe] failed to downgrade canceled subscription", error);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
