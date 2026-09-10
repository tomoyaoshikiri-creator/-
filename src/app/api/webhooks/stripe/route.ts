import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { getStripeClient, planForPriceId } from "@/lib/stripe";
import { logError } from "@/lib/logger";
import { recordAuditEvent } from "@/lib/auditLog";
import { sendTrackedEmail } from "@/lib/emailNotify";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";

// Stripeからのサブスクリプション関連イベントを受け取り、teamsのplan/契約状態に反映する。
// 生ボディで署名検証する必要があるため request.text() を使う(request.json()は使わない)。
//
// 冪等化: event.idをstripe_webhook_eventsに「記録してから処理」する。同時到達した
// 重複配信の後発側はunique制約(id)で弾かれ、既にsucceededなら即200でスキップする。
// 処理に失敗した場合は行をfailedのまま残し、5xxを返してStripeに再送させる
// (次回の再送でも同じclaimの上から再処理できる)。
//
// 未知のPrice ID・DB更新失敗・必須環境変数欠落はいずれも処理失敗として扱い、
// 以前のように黙って200を返す(=Stripeが再送しない)ことはしない。
export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripe || !webhookSecret || !serviceRoleKey) {
    logError("[webhooks/stripe] missing STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET/SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
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
    logError("[webhooks/stripe] signature verification failed", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const adminClient = createSupabaseJsClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const payloadHash = createHash("sha256").update(rawBody).digest("hex");

  const { error: claimError } = await adminClient
    .from("stripe_webhook_events")
    .insert({ id: event.id, type: event.type, payload_hash: payloadHash });

  if (claimError) {
    // unique_violation = 既にこのevent.idの行が存在する(重複配信、または以前の再送)。
    if (claimError.code === "23505") {
      const { data: existing } = await adminClient
        .from("stripe_webhook_events")
        .select("status")
        .eq("id", event.id)
        .maybeSingle();
      if (existing?.status === "succeeded") {
        return NextResponse.json({ received: true, deduplicated: true });
      }
      // processing/failed(前回の試行が失敗した、または処理中にクラッシュした)の場合は
      // 再処理を許可する。以降の処理成功時にstatus=succeededへ更新する。
    } else {
      logError("[webhooks/stripe] failed to claim event", claimError);
      return NextResponse.json({ error: "failed to record event" }, { status: 500 });
    }
  }

  async function syncSubscription(subscription: Stripe.Subscription): Promise<boolean> {
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    const priceId = subscription.items.data[0]?.price.id ?? null;
    const plan = planForPriceId(priceId);
    if (!plan) {
      logError(`[webhooks/stripe] unknown price id ${priceId} for customer ${customerId}`);
      return false;
    }
    const { data, error } = await adminClient
      .from("teams")
      .update({ plan, stripe_subscription_id: subscription.id, subscription_status: subscription.status })
      .eq("stripe_customer_id", customerId)
      .select("id");
    if (error) {
      logError("[webhooks/stripe] failed to sync subscription", error);
      return false;
    }
    for (const team of data ?? []) {
      await recordAuditEvent(adminClient, {
        teamId: team.id,
        actorId: null,
        action: "billing_plan_changed",
        targetType: "team",
        targetId: team.id,
        detail: { plan, subscription_status: subscription.status },
      });
    }
    return true;
  }

  // 請求失敗を各チームの管理者へメールで知らせる(B-4)。プラン反映自体は
  // syncSubscriptionが担うため、こちらは通知専用で失敗してもwebhook処理自体は失敗させない。
  async function notifyAdminsOfPaymentFailure(customerId: string): Promise<void> {
    const { data: team } = await adminClient.from("teams").select("id, name").eq("stripe_customer_id", customerId).maybeSingle();
    if (!team) return;
    const { data: admins } = await adminClient.from("team_memberships").select("user_id").eq("team_id", team.id).eq("role", "管理者");
    const adminIds = (admins ?? []).map((a) => a.user_id);
    if (adminIds.length === 0) return;
    const { data: adminProfiles } = await adminClient.from("profiles").select("id, email").in("id", adminIds);
    await Promise.all(
      (adminProfiles ?? [])
        .filter((p): p is { id: string; email: string } => !!p.email)
        .map((p) =>
          sendTrackedEmail(adminClient, {
            teamId: team.id,
            recipientEmail: p.email,
            eventType: "billing_payment_failed",
            subject: "【CIRCLE LINES】お支払いに失敗しました",
            html: `<p>チーム「${team.name}」のお支払いに失敗しました。カード情報をご確認のうえ、設定画面の「プラン」からお支払い方法を更新してください。</p>`,
          }),
        ),
    );
  }

  let ok = true;
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        ok = await syncSubscription(subscription);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      ok = await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      const { data, error } = await adminClient
        .from("teams")
        .update({ plan: "お試し", stripe_subscription_id: null, subscription_status: "canceled" })
        .eq("stripe_customer_id", customerId)
        .select("id");
      if (error) {
        logError("[webhooks/stripe] failed to downgrade canceled subscription", error);
        ok = false;
      } else {
        for (const team of data ?? []) {
          await recordAuditEvent(adminClient, {
            teamId: team.id,
            actorId: null,
            action: "billing_subscription_canceled",
            targetType: "team",
            targetId: team.id,
          });
        }
      }
      break;
    }
    case "invoice.payment_failed": {
      // customer.subscription.updated(status: past_due等)が別途届くはずだが、
      // 取りこぼし・順序前後への保険として、請求書からもsubscriptionを取り直して同期する。
      // Invoice.subscriptionは廃止済みで、現行APIではparent.subscription_detailsにある。
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionRef =
        invoice.parent?.type === "subscription_details" ? invoice.parent.subscription_details?.subscription : null;
      const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        ok = await syncSubscription(subscription);
        if (ok) {
          const customerId =
            typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
          await notifyAdminsOfPaymentFailure(customerId);
        }
      }
      break;
    }
    default:
      break;
  }

  await adminClient
    .from("stripe_webhook_events")
    .update(ok ? { status: "succeeded", processed_at: new Date().toISOString() } : { status: "failed" })
    .eq("id", event.id);

  if (!ok) {
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
