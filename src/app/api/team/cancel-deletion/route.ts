import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

// 退会手続き中(deletion_requested_at設定済み)のチームについて、猶予期間内であれば
// 管理者が取り消せる。取り消すとStripeのサブスクリプションは元に戻らないため
// (request-deletion時点で即時解約済み)、有料プランを使い続けたい場合は
// 「設定 > プラン」から改めて申し込みが必要になる旨をUI側で案内する。
export async function POST() {
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

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "サーバー側の設定が不足しています(SUPABASE_SERVICE_ROLE_KEY)" }, { status: 500 });
  }
  const adminClient = createSupabaseJsClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: team } = await adminClient
    .from("teams")
    .select("deletion_requested_at")
    .eq("id", teamId)
    .single();
  if (!team?.deletion_requested_at) {
    return NextResponse.json({ error: "退会手続き中ではありません" }, { status: 400 });
  }

  const { error } = await adminClient
    .from("teams")
    .update({ deletion_requested_at: null, deletion_requested_by: null })
    .eq("id", teamId);
  if (error) {
    return NextResponse.json({ error: `取り消しに失敗しました: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
