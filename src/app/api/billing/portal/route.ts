import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe";

// 契約中のチーム向けに、Stripeのカスタマーポータル(支払い方法の変更・請求履歴・解約)への
// リンクを発行する。ポータル自体はStripe側がホストするため、こちらでは何も実装せず済む。
export async function POST(request: Request) {
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

  const { data: team } = await supabase
    .from("teams")
    .select("stripe_customer_id")
    .eq("id", teamId)
    .single();
  if (!team?.stripe_customer_id) {
    return NextResponse.json({ error: "契約情報が見つかりません" }, { status: 404 });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "Stripeの設定が未完了です" }, { status: 500 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const session = await stripe.billingPortal.sessions.create({
    customer: team.stripe_customer_id,
    return_url: `${origin}/settings/plan`,
  });

  return NextResponse.json({ url: session.url });
}
