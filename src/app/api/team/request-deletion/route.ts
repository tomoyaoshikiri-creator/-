import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe";
import type { Database } from "@/lib/database.types";

// 管理者がチームの退会(完全削除)を申請する。即座には削除せず、deletion_requested_at
// から7日間の猶予期間を設け、その間は/api/team/cancel-deletionで取り消せる
// (実際の完全削除はcron/attendance-remindersの日次バッチが行う)。
// 有料プラン契約中の場合はこの時点でStripeサブスクリプションを即時解約し、
// 猶予期間中に二重で請求されないようにする(Webhook経由でplanは自動的に
// お試しへ戻る)。deletion_requested_atはprotect_team_billing_columnsトリガーの
// 保護対象のため、通常のRLSクライアントからは書き込めずservice_role必須。
export async function POST() {
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

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "サーバー側の設定が不足しています(SUPABASE_SERVICE_ROLE_KEY)" }, { status: 500 });
  }
  const adminClient = createSupabaseJsClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: team } = await adminClient
    .from("teams")
    .select("id, stripe_subscription_id, deletion_requested_at")
    .eq("id", profile.team_id)
    .single();
  if (!team) {
    return NextResponse.json({ error: "チームが見つかりません" }, { status: 404 });
  }
  if (team.deletion_requested_at) {
    return NextResponse.json({ error: "既に退会手続き中です" }, { status: 400 });
  }

  if (team.stripe_subscription_id) {
    const stripe = getStripeClient();
    if (stripe) {
      try {
        await stripe.subscriptions.cancel(team.stripe_subscription_id);
      } catch (err) {
        console.error("[api/team/request-deletion] failed to cancel Stripe subscription", err);
        return NextResponse.json(
          { error: "サブスクリプションの解約に失敗しました。時間をおいて再度お試しください。" },
          { status: 502 },
        );
      }
    }
  }

  const deletionRequestedAt = new Date().toISOString();
  const { error: updateError } = await adminClient
    .from("teams")
    .update({ deletion_requested_at: deletionRequestedAt, deletion_requested_by: user.id })
    .eq("id", team.id);
  if (updateError) {
    return NextResponse.json({ error: `退会手続きの登録に失敗しました: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deletionRequestedAt });
}
