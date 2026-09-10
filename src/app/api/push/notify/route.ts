import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { playerFullName } from "@/lib/format";
import type { Database } from "@/lib/database.types";

// チーム内の自分以外の購読者にWeb Pushを送る。鍵が未設定の環境(このリポジトリの
// デフォルト状態)ではskipped:trueを返すだけで、呼び出し元(お知らせ投稿など)を
// 失敗させない。
//
// クライアントからは{eventType, refId}のみを受け取り、文面・宛先はここ(サーバー側)で
// 対象データを引いて組み立てる(A-8)。以前はtitle/body/target*をクライアントから
// そのまま受け取っており、認証済みメンバーなら誰でも任意の文面・宛先でチーム内に
// 通知を送れる状態だった。
//
// refIdで参照する行の取得には、原則としてリクエストスコープのクライアント(RLS適用)を使う。
// 例えばgame_match_notes/player_notesは「指導者・管理者のみSELECT可能」というRLSが
// 既にあるため、一般ロールの呼び出しは自動的に「行が見えない」扱いになり、この関数の
// 追加の権限チェックなしに弾かれる。お知らせ・選手メモ等の「投稿者本人か」の確認は
// author_id/sender_id === user.idの比較で行う。
export async function POST(request: Request) {
  const { eventType, refId } = await request.json();
  if (typeof eventType !== "string" || typeof refId !== "string" || !refId) {
    return NextResponse.json({ error: "eventType/refId is required" }, { status: 400 });
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

  const adminClient = createSupabaseJsClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 頻度制限。同一ユーザーからの短時間の連投を弾く(DB関数でアトミックに判定・記録)。
  const { data: allowed, error: rateLimitError } = await adminClient.rpc("check_and_increment_push_notify_rate_limit", {
    p_user_id: user.id,
    p_window_seconds: 60,
    p_max_count: 20,
  });
  if (rateLimitError) {
    console.error("[push/notify] rate limit check failed", rateLimitError);
    return NextResponse.json({ error: rateLimitError.message }, { status: 500 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "送信頻度の上限を超えました。しばらく待ってから再度お試しください。" }, { status: 429 });
  }

  let title: string;
  let body = "";
  let url = "/";
  let memberIds: string[];

  switch (eventType) {
    case "notice_created": {
      const { data: notice } = await supabase
        .from("notices")
        .select("id, title, sender_id")
        .eq("id", refId)
        .maybeSingle();
      if (!notice || notice.sender_id !== user.id) {
        return NextResponse.json({ error: "お知らせが見つかりません" }, { status: 404 });
      }
      title = "📢 新しいお知らせ";
      body = notice.title;
      url = `/notice/${notice.id}`;
      // audience('全員'/'指導者のみ'/'役員以上'/'学年指定')を尊重した宛先。
      // notices_select(0027)のRLSポリシーと同じ条件のDB関数(0139)で判定する。
      const { data: recipientIds, error: recError } = await adminClient.rpc("notice_audience_recipient_ids", {
        p_notice_id: notice.id,
      });
      if (recError) {
        console.error("[push/notify] failed to resolve notice audience", recError);
        return NextResponse.json({ error: recError.message }, { status: 500 });
      }
      memberIds = recipientIds ?? [];
      break;
    }
    case "notice_reaction": {
      const { data: notice } = await supabase.from("notices").select("id, title, sender_id").eq("id", refId).maybeSingle();
      if (!notice?.sender_id) {
        return NextResponse.json({ ok: true, target: 0, sent: 0, failures: [] });
      }
      title = "リアクションがつきました";
      body = `${await getActorName(supabase, user.id)}さんが「${notice.title}」にリアクションしました`;
      url = `/notice/${notice.id}`;
      memberIds = [notice.sender_id];
      break;
    }
    case "game_note_reaction": {
      const { data: note } = await supabase
        .from("game_match_notes")
        .select("id, author_id, game_match_id")
        .eq("id", refId)
        .maybeSingle();
      if (!note?.author_id) {
        return NextResponse.json({ ok: true, target: 0, sent: 0, failures: [] });
      }
      title = "リアクションがつきました";
      body = `${await getActorName(supabase, user.id)}さんがコーチメモにリアクションしました`;
      url = `/game/${note.game_match_id}`;
      memberIds = [note.author_id];
      break;
    }
    case "game_note_created": {
      const { data: note } = await supabase
        .from("game_match_notes")
        .select("id, author_id, game_match_id")
        .eq("id", refId)
        .maybeSingle();
      if (!note || note.author_id !== user.id) {
        return NextResponse.json({ error: "コーチメモが見つかりません" }, { status: 404 });
      }
      const { data: match } = await supabase.from("game_matches").select("opponent").eq("id", note.game_match_id).maybeSingle();
      const opponent = match?.opponent;
      title = "📝 コーチメモが登録されました";
      body = opponent ? `vs ${opponent} のコーチメモが登録されました` : "コーチメモが登録されました";
      url = `/game/${note.game_match_id}`;
      memberIds = await staffMemberIds(adminClient, teamId);
      break;
    }
    case "player_note_reaction": {
      const { data: note } = await supabase
        .from("player_notes")
        .select("id, author_id, player_id")
        .eq("id", refId)
        .maybeSingle();
      if (!note?.author_id) {
        return NextResponse.json({ ok: true, target: 0, sent: 0, failures: [] });
      }
      const player = await getPlayerName(supabase, note.player_id);
      title = "リアクションがつきました";
      body = `${await getActorName(supabase, user.id)}さんが${player}のメモにリアクションしました`;
      url = `/players/${note.player_id}/notes`;
      memberIds = [note.author_id];
      break;
    }
    case "player_note_created": {
      const { data: note } = await supabase
        .from("player_notes")
        .select("id, author_id, player_id")
        .eq("id", refId)
        .maybeSingle();
      if (!note || note.author_id !== user.id) {
        return NextResponse.json({ error: "選手メモが見つかりません" }, { status: 404 });
      }
      const player = await getPlayerName(supabase, note.player_id);
      title = "📝 選手メモが登録されました";
      body = `${player}のメモが登録されました`;
      url = `/players/${note.player_id}/notes`;
      memberIds = await staffMemberIds(adminClient, teamId);
      break;
    }
    default:
      return NextResponse.json({ error: "unknown eventType" }, { status: 400 });
  }

  if (memberIds.length === 0) {
    return NextResponse.json({ ok: true, target: 0, sent: 0, failures: [] });
  }

  const { data: subs, error: subsError } = await adminClient
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("team_id", teamId)
    .neq("user_id", user.id)
    .in("user_id", memberIds);

  if (subsError) {
    console.error("[push/notify] failed to load subscriptions", subsError);
    return NextResponse.json({ ok: false, error: subsError.message }, { status: 500 });
  }

  const payload = JSON.stringify({ title, body, url });
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

async function getActorName(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("name").eq("id", userId).maybeSingle();
  return data?.name ?? "誰か";
}

async function getPlayerName(supabase: Awaited<ReturnType<typeof createClient>>, playerId: string): Promise<string> {
  const { data } = await supabase.from("players").select("sei, mei").eq("id", playerId).maybeSingle();
  return data ? playerFullName(data) : "選手";
}

async function staffMemberIds(adminClient: SupabaseClient<Database>, teamId: string): Promise<string[]> {
  const { data } = await adminClient
    .from("team_memberships")
    .select("user_id")
    .eq("team_id", teamId)
    .in("role", ["指導者", "管理者"]);
  return (data ?? []).map((m) => m.user_id);
}
