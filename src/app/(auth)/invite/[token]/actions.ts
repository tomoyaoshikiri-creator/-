"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/origin";

export interface FormState {
  error?: string;
  message?: string;
}

export async function acceptInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const sei = String(formData.get("sei") ?? "").trim();
  const mei = String(formData.get("mei") ?? "").trim();
  const name = `${sei}${mei}`;
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const playerIds = formData.getAll("playerId").map(String).filter((id) => id !== "");

  if (!token || !sei || !mei || !email || !password) {
    return { error: "すべての項目を入力してください" };
  }
  if (password.length < 8) {
    return { error: "パスワードは8文字以上で入力してください" };
  }

  const origin = await getRequestOrigin();
  const completeParams = new URLSearchParams({ kind: "invite", token, name });
  if (playerIds.length > 0) completeParams.set("playerIds", playerIds.join(","));
  const next = `/auth/complete?${completeParams.toString()}`;
  const emailRedirectTo = `${origin}/auth/confirm?next=${encodeURIComponent(next)}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });
  if (error) return { error: error.message };
  if (!data.user) return { error: "アカウントの作成に失敗しました" };

  if (!data.session) {
    return {
      message: "確認メールを送信しました。メール内のリンクを開いて認証を完了してください。",
    };
  }

  const { error: rpcError } = await supabase.rpc("accept_invite", {
    invite_token: token,
    member_name: name,
    player_ids: playerIds,
  });
  if (rpcError) return { error: rpcError.message };

  redirect("/schedule");
}

export interface AcceptInviteAsExistingUserState {
  error?: string;
  switchFailed?: boolean;
}

// ログイン済み既存ユーザー専用。signUp()は行わず、既存セッションに対して
// accept_invite RPCのみを実行する。accept_invite()のhas_profile=true分岐
// (0118)はmember_nameを使用しない(profiles.nameは変更しない設計のため)ので、
// 氏名は空文字で渡す。
//
// accept_invite()自体は呼び出し元(このアクション)から見て冪等ではない
// (呼ぶたびにteam_membershipsへ新しい行が作られる)ため、switch_active_team()が
// 失敗してもaccept_invite()を再実行しない。参加済みチームへの切り替えは
// /select-teamから手動で行えるよう案内するに留める。
export async function acceptInviteAsExistingUser(
  _prev: AcceptInviteAsExistingUserState,
  formData: FormData,
): Promise<AcceptInviteAsExistingUserState> {
  const token = String(formData.get("token") ?? "");
  const playerIds = formData.getAll("playerId").map(String).filter((id) => id !== "");

  const supabase = await createClient();

  const { data: teamId, error: acceptError } = await supabase.rpc("accept_invite", {
    invite_token: token,
    member_name: "",
    player_ids: playerIds,
  });
  if (acceptError) return { error: acceptError.message };
  if (!teamId) return { error: "招待の受諾に失敗しました" };

  const { error: switchError } = await supabase.rpc("switch_active_team", { target_team_id: teamId });
  if (switchError) {
    return { switchFailed: true };
  }

  revalidatePath("/", "layout");
  redirect("/schedule");
}
