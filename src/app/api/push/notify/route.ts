import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

// チーム内の自分以外の購読者にWeb Pushを送る。鍵が未設定の環境(このリポジトリの
// デフォルト状態)ではskipped:trueを返すだけで、呼び出し元(お知らせ投稿など)を
// 失敗させない。
export async function POST(request: Request) {
  const { title, body, url } = await request.json();
  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", user.id).single();
  if (!profile) {
    return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 404 });
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!vapidPublicKey || !vapidPrivateKey || !serviceRoleKey) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  webpush.setVapidDetails("mailto:info@faith-creation.jp", vapidPublicKey, vapidPrivateKey);

  const adminClient = createSupabaseJsClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: subs, error: subsError } = await adminClient
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("team_id", profile.team_id)
    .neq("user_id", user.id);

  if (subsError) {
    console.error("[push/notify] failed to load subscriptions", subsError);
    return NextResponse.json({ ok: false, error: subsError.message }, { status: 500 });
  }

  const payload = JSON.stringify({ title, body: body ?? "", url: url ?? "/" });
  let sent = 0;
  const failures: string[] = [];

  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, payload);
        sent += 1;
      } catch (err) {
        // 端末側で解除済み/期限切れの購読は410 Goneや404で返るので、DBからも掃除しておく。
        const statusCode = (err as { statusCode?: number } | null)?.statusCode;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[push/notify] send failed (subscription ${s.id}, status ${statusCode})`, message);
        failures.push(`${statusCode ?? "?"}: ${message}`);
        if (statusCode === 404 || statusCode === 410) {
          await adminClient.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }),
  );

  return NextResponse.json({ ok: true, target: (subs ?? []).length, sent, failures });
}
