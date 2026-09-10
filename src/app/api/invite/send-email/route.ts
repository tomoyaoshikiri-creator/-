import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { canIssueInvite } from "@/lib/permissions";
import { sendTrackedEmail } from "@/lib/emailNotify";
import type { Database, Role } from "@/lib/database.types";

export const dynamic = "force-dynamic";

// 招待リンクをメールで送る(B-4)。招待リンク自体は複数人が使い回せる共有リンクで、
// 特定の宛先と紐付いていない(invitesテーブルにメール列はない)ため、ここでは
// 「今ある招待リンクを、指定したメールアドレス宛に送る」だけの薄いRouteにする
// (invitesの仕様自体は変更しない)。
export async function POST(request: Request) {
  const { token, email } = await request.json();
  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "招待リンクを指定してください" }, { status: 400 });
  }
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "有効なメールアドレスを入力してください" }, { status: 400 });
  }

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
  if (!teamId || !role || !canIssueInvite(role as Role)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  // invites_select RLSにより、自チームの招待だけが見える。
  const { data: invite } = await supabase.from("invites").select("id, role, token, expires_at").eq("token", token).maybeSingle();
  if (!invite) {
    return NextResponse.json({ error: "招待リンクが見つかりません" }, { status: 404 });
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "この招待リンクは有効期限切れです" }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "サーバー側の設定が不足しています(SUPABASE_SERVICE_ROLE_KEY)" }, { status: 500 });
  }
  const adminClient = createSupabaseJsClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const inviteUrl = `${new URL(request.url).origin}/invite/${invite.token}`;
  const roleLabel = invite.role === "一般" ? "保護者" : "指導者";
  const sent = await sendTrackedEmail(adminClient, {
    teamId,
    recipientEmail: email,
    eventType: "invite_issued",
    subject: "【CIRCLE LINES】チームへの招待が届いています",
    html: `<p>CIRCLE LINESでチームへの招待(${roleLabel}用)が届いています。</p><p><a href="${inviteUrl}">${inviteUrl}</a></p><p>このリンクの有効期限: ${invite.expires_at}</p>`,
  });

  if (!sent) {
    return NextResponse.json({ error: "メール送信に失敗しました。リンクを直接共有するか、時間をおいて再度お試しください" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
