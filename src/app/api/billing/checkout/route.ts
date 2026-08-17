import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient, priceIdForPlan } from "@/lib/stripe";
import type { Database } from "@/lib/database.types";

// 管理者が中間/フルプランへの契約を開始するためのStripe Checkoutセッションを作る。
// teams.stripe_customer_idの書き込みはservice_roleクライアント経由でのみ行う
// (0083のprotect_team_billing_columnsトリガーが通常ユーザーからの直接更新を弾くため)。
export async function POST(request: Request) {
  const { plan } = await request.json();
  if (plan !== "中間" && plan !== "フル") {
    return NextResponse.json({ error: "plan は 中間 または フル を指定してください" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role, team_id").eq("id", user.id).single();
  if (!profile || profile.role !== "管理者") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const stripe = getStripeClient();
  const priceId = priceIdForPlan(plan);
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

  const { data: team } = await adminClient.from("teams").select("*").eq("id", profile.team_id).single();
  if (!team) {
    return NextResponse.json({ error: "チームが見つかりません" }, { status: 404 });
  }

  let customerId = team.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ name: team.name, metadata: { team_id: team.id } });
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
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/settings/storage?checkout=success`,
    cancel_url: `${origin}/settings/storage?checkout=cancel`,
    metadata: { team_id: team.id, plan },
    subscription_data: { metadata: { team_id: team.id, plan } },
  });

  if (!session.url) {
    return NextResponse.json({ error: "決済ページの作成に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ url: session.url });
}
