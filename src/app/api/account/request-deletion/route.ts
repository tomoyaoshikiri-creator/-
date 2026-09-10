import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe";
import { logError } from "@/lib/logger";
import type { Database } from "@/lib/database.types";

// 「このサービスから退会する」= auth.usersごとアカウントを完全に削除する(A-7)。
// 「チームを退会する」(管理者によるチーム自体の削除、close-account/request-deletion)とは
// 別の操作。
//
// 所属チームごとに扱いが分かれる:
// - 自分が「最後の管理者」ではないチーム: 即座にteam_memberships/player_guardiansから
//   脱退させる(チーム自体・他のメンバーには影響しない)。
// - 自分が「最後の管理者」であるチーム: protect_last_team_admin()トリガーがteam_memberships
//   の直接削除を拒否するため、既存のチーム退会(7日猶予、teams.deletion_requested_at)と
//   同じ手続きをトリガーする。猶予期間中にteamDeletionJob.tsがそのチームを実際に削除した
//   時点で、account_deletion_requestsを見てauth.admin.deleteUser()が呼ばれる
//   (このRoute自身はまだアカウントを削除しない)。
// 管理しているチームが1つもなければ、その場でauth.admin.deleteUser()を呼ぶ。
export async function POST(request: Request) {
  const { password } = await request.json();
  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "パスワードを入力してください" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  // 本人確認。signInWithPassword()自体は既存セッションを壊さない(成功時は単にトークンが
  // 更新されるだけ)。
  const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password });
  if (reauthError) {
    return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "サーバー側の設定が不足しています(SUPABASE_SERVICE_ROLE_KEY)" }, { status: 500 });
  }
  const adminClient = createSupabaseJsClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: memberships, error: membershipsError } = await adminClient
    .from("team_memberships")
    .select("team_id, role")
    .eq("user_id", user.id);
  if (membershipsError) {
    return NextResponse.json({ error: `所属情報の取得に失敗しました: ${membershipsError.message}` }, { status: 500 });
  }

  const removableTeamIds: string[] = [];
  const lastAdminTeamIds: string[] = [];

  for (const m of memberships ?? []) {
    if (m.role !== "管理者") {
      removableTeamIds.push(m.team_id);
      continue;
    }
    const { count } = await adminClient
      .from("team_memberships")
      .select("id", { count: "exact", head: true })
      .eq("team_id", m.team_id)
      .eq("role", "管理者");
    if ((count ?? 0) <= 1) {
      lastAdminTeamIds.push(m.team_id);
    } else {
      removableTeamIds.push(m.team_id);
    }
  }

  // 最後の管理者ではないチームは即座に脱退する(チーム自体・他のメンバーへの影響なし)。
  for (const teamId of removableTeamIds) {
    await adminClient.from("player_guardians").delete().eq("profile_id", user.id).eq("team_id", teamId);
    const { error } = await adminClient.from("team_memberships").delete().eq("user_id", user.id).eq("team_id", teamId);
    if (error) {
      return NextResponse.json({ error: `チーム脱退処理に失敗しました: ${error.message}` }, { status: 500 });
    }
  }

  // 最後の管理者であるチームは、既存のチーム退会(7日猶予)と同じ手続きをトリガーする。
  const pendingTeamNames: string[] = [];
  for (const teamId of lastAdminTeamIds) {
    const { data: team } = await adminClient
      .from("teams")
      .select("id, name, stripe_subscription_id, deletion_requested_at")
      .eq("id", teamId)
      .single();
    if (!team) continue;
    if (team.deletion_requested_at) {
      pendingTeamNames.push(team.name);
      continue; // 既に別の経路で退会手続き中
    }
    if (team.stripe_subscription_id) {
      const stripe = getStripeClient();
      if (stripe) {
        try {
          await stripe.subscriptions.cancel(team.stripe_subscription_id);
        } catch (err) {
          logError("[api/account/request-deletion] failed to cancel Stripe subscription", err);
          return NextResponse.json(
            { error: "サブスクリプションの解約に失敗しました。時間をおいて再度お試しください。" },
            { status: 502 },
          );
        }
      }
    }
    const { error } = await adminClient
      .from("teams")
      .update({ deletion_requested_at: new Date().toISOString(), deletion_requested_by: user.id })
      .eq("id", teamId);
    if (error) {
      return NextResponse.json({ error: `チーム退会手続きの登録に失敗しました: ${error.message}` }, { status: 500 });
    }
    pendingTeamNames.push(team.name);
  }

  if (lastAdminTeamIds.length === 0) {
    const { error } = await adminClient.auth.admin.deleteUser(user.id);
    if (error) {
      return NextResponse.json({ error: `アカウントの削除に失敗しました: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true, immediate: true });
  }

  // 猶予中のチームが1つ以上あるため、それらが完全削除された時点でアカウントも
  // 削除されるよう記録する(実際の削除はteamDeletionJob.tsが行う)。
  const { error: pendingError } = await adminClient
    .from("account_deletion_requests")
    .upsert({ user_id: user.id, requested_at: new Date().toISOString() });
  if (pendingError) {
    return NextResponse.json({ error: `退会手続きの登録に失敗しました: ${pendingError.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, immediate: false, pendingTeams: pendingTeamNames });
}
