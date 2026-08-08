import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

// ユーザー削除は profiles 行だけでなく auth.users(メールアドレス含む)も完全に削除する。
// GoTrueのAdmin APIはservice_roleキーが必須のため、このRoute Handler内でのみ使用する
// (ブラウザには絶対に渡さない)。呼び出し元が同じチームの管理者であることは
// 通常のCookie認証クライアント(RLS適用)で確認してから、service_roleクライアントで実行する。
export async function POST(request: Request) {
  const { targetId } = await request.json();
  if (!targetId || typeof targetId !== "string") {
    return NextResponse.json({ error: "targetId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role, team_id")
    .eq("id", user.id)
    .single();
  if (!callerProfile || callerProfile.role !== "管理者") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id, team_id, role")
    .eq("id", targetId)
    .single();
  if (!targetProfile || targetProfile.team_id !== callerProfile.team_id) {
    return NextResponse.json({ error: "対象のユーザーが見つかりません" }, { status: 404 });
  }
  if (targetProfile.role === "管理者") {
    return NextResponse.json(
      { error: "管理者ユーザーは削除できません。先に権限を変更してください。" },
      { status: 400 },
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "サーバー側の設定が不足しています(SUPABASE_SERVICE_ROLE_KEY)" }, { status: 500 });
  }

  const adminClient = createSupabaseJsClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // profiles.id は auth.users(id) の on delete cascade 参照のため、
  // auth.users側を削除すればprofiles行(と紐づくattendances等)も自動的に削除される。
  const { error } = await adminClient.auth.admin.deleteUser(targetId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
