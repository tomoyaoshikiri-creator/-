import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

// チーム内の自分以外の購読者にWeb Pushを送る。鍵が未設定の環境(このリポジトリの
// デフォルト状態)ではskipped:trueを返すだけで、呼び出し元(お知らせ投稿など)を
// 失敗させない。
// targetUserIds/targetRolesを指定しなければ従来通りチーム全員(自分以外)へ送る。
// targetUserIdsを指定すればそのuser_idのみ(リアクション通知で投稿者だけに送る用途)、
// targetRolesを指定すればそのroleのteam_membershipsに絞る(指導者・管理者専用の
// コーチメモ/選手メモの登録通知で、閲覧権限のない一般ロールへ内容が漏れないようにする用途)。
export async function POST(request: Request) {
  const { title, body, url, targetUserIds, targetRoles } = await request.json();
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

  const { data: teamId } = await supabase.rpc("current_team_id");
  if (!teamId) {
    return NextResponse.json({ error: "セッション情報を取得できませんでした" }, { status: 404 });
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

  let memberIds: string[] | null = null;
  if (Array.isArray(targetUserIds)) {
    memberIds = targetUserIds;
  } else if (Array.isArray(targetRoles) && targetRoles.length > 0) {
    const { data: members, error: membersError } = await adminClient
      .from("team_memberships")
      .select("user_id")
      .eq("team_id", teamId)
      .in("role", targetRoles);
    if (membersError) {
      console.error("[push/notify] failed to load team_memberships", membersError);
      return NextResponse.json({ ok: false, error: membersError.message }, { status: 500 });
    }
    memberIds = (members ?? []).map((m) => m.user_id);
  }

  if (memberIds !== null && memberIds.length === 0) {
    return NextResponse.json({ ok: true, target: 0, sent: 0, failures: [] });
  }

  let subsQuery = adminClient
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("team_id", teamId)
    .neq("user_id", user.id);
  if (memberIds !== null) {
    subsQuery = subsQuery.in("user_id", memberIds);
  }
  const { data: subs, error: subsError } = await subsQuery;

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
