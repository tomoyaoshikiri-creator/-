import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { endpoint, keys } = await request.json();
  if (!endpoint || typeof endpoint !== "string" || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
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

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      team_id: teamId,
      endpoint,
      p256dh: keys.p256dh,
      auth_key: keys.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { endpoint } = await request.json();
  if (!endpoint || typeof endpoint !== "string") {
    return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
