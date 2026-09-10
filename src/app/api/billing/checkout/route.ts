import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient, priceIdForPlan, type BillingInterval } from "@/lib/stripe";
import { shouldUseBillingPortal } from "@/lib/billing";
import type { Database } from "@/lib/database.types";

// 管理者が中間/フルプランへの契約を開始するためのStripe Checkoutセッションを作る。
// teams.stripe_customer_idの書き込みはservice_roleクライアント経由でのみ行う
// (0083のprotect_team_billing_columnsトリガーが通常ユーザーからの直接更新を弾くため)。
export async function POST(request: Request) {
  const { plan, interval } = await request.json();
  if (plan !== "中間" && plan !== "フル" && plan !== "フルプラス") {
    return NextResponse.json({ error: "plan は 中間・フル・フルプラス のいずれかを指定してください" }, { status: 400 });
  }
  const billingInterval: BillingInterval = interval === "yearly" ? "yearly" : "monthly";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const [{ data: teamId }, { data: role }] = await Promise.all([
    supabase.rpc("current_team_id"),
    supabase.rpc("current_role"),
  ]);
  if (!teamId || role !== "管理者") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const stripe = getStripeClient();
  const priceId = priceIdForPlan(plan, billingInterval);
  if (!stripe || !priceId) {
    return NextResponse.json({ error: "Stripeの設定が未完了です" }, { status: 500 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "サーバー側の設定が不足しています(SUPABASE_SERVICE_ROLE_KEY)" }, { status: 500 });
  }
  const adminClient = createSupabaseJsClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: team } = await adminClient.from("teams").select("*").eq("id", teamId).single();
  if (!team) {
    return NextResponse.json({ error: "チームが見つかりません" }, { status: 404 });
  }

  // 既にactive/trialing等の有効なSubscriptionがある状態で新規Checkoutを許すと、
  // 同一チームに複数のSubscriptionができてしまう(二重課金)。shouldUseBillingPortal()は
  // /settings/planが「申し込む」ボタンではなくBilling Portalへの導線を出す条件と同じ
  // (UIを迂回した直接リクエストへの防御として、サーバー側でも同じ条件で拒否する)。
  if (shouldUseBillingPortal(team.subscription_status)) {
    return NextResponse.json(
      { error: "既にお申し込み済みです。お支払い管理ページから変更・解約を行ってください。" },
      { status: 409 },
    );
  }

  let customerId = team.stripe_customer_id;
  if (!customerId) {
    // 1チームにつきCustomerは1つだけのはずなので、team.id単独でidempotency keyにする
    // (時間経過で再発行してよいCheckout Session側とは異なり、こちらは恒久的に同じキー)。
    const customerIdempotencyKey = createHash("sha256").update(`billing-customer:${team.id}`).digest("hex");
    const customer = await stripe.customers.create(
      { name: team.name, metadata: { team_id: team.id } },
      { idempotencyKey: customerIdempotencyKey },
    );
    customerId = customer.id;
    const { error: updateError } = await adminClient
      .from("teams")
      .update({ stripe_customer_id: customerId })
      .eq("id", team.id);
    if (updateError) {
      return NextResponse.json({ error: `顧客情報の保存に失敗しました: ${updateError.message}` }, { status: 500 });
    }
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  // 連打・並行リクエストでこのRoute Handlerが同時に複数回呼ばれても、Stripe側で
  // 同一Checkout Sessionが返るようにidempotency keyを付与する(2重サブスク対策)。
  // 分単位でバケット化: 同一チーム・同一プランへの短時間の連打は1つの呼び出しに
  // まとめる一方、時間を置いた別の(正当な)申し込みまで永続的にブロックしない。
  const idempotencyBucket = Math.floor(Date.now() / 60_000);
  const idempotencyKey = createHash("sha256")
    .update(`billing-checkout:${team.id}:${plan}:${billingInterval}:${idempotencyBucket}`)
    .digest("hex");

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings/plan?checkout=success`,
      cancel_url: `${origin}/settings/plan?checkout=cancel`,
      metadata: { team_id: team.id, plan, interval: billingInterval },
      subscription_data: { metadata: { team_id: team.id, plan, interval: billingInterval } },
    },
    { idempotencyKey },
  );

  if (!session.url) {
    return NextResponse.json({ error: "決済ページの作成に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ url: session.url });
}
