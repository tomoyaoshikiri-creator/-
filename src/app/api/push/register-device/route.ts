import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ネイティブアプリ(iOS/Android)向けPush通知の登録先(ユーザー指示 項目5)。
// ネイティブラッパー実装時に、Capacitorのpush notificationsプラグインが
// 取得したデバイストークンをここへ登録する。/api/push/subscribe(Web Push)と
// 同じ構成(request-scopeクライアント、RLSで本人のteam_idに限定)。
export async function POST(request: Request) {
  const { platform, token } = await request.json();
  if ((platform !== "ios" && platform !== "android") || !token || typeof token !== "string") {
    return NextResponse.json({ error: "invalid device token" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { data: teamId } = await supabase.rpc("current_team_id");
  if (!teamId) {
    return NextResponse.json({ error: "セッション情報を取得できませんでした" }, { status: 404 });
  }

  const { error } = await supabase.from("device_push_tokens").upsert(
    {
      user_id: user.id,
      team_id: teamId,
      platform,
      token,
    },
    { onConflict: "platform,token" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { platform, token } = await request.json();
  if ((platform !== "ios" && platform !== "android") || !token || typeof token !== "string") {
    return NextResponse.json({ error: "invalid device token" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  await supabase.from("device_push_tokens").delete().eq("platform", platform).eq("token", token).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
