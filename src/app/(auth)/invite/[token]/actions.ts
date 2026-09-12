"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/origin";
import { getClientIp } from "@/lib/clientIp";
import { checkRateLimit } from "@/lib/rateLimit";
import { CURRENT_TERMS_VERSION } from "@/lib/legal";

export interface FormState {
  error?: string;
  message?: string;
  // メール確認待ち(確認コード入力)の状態に入っているかどうか。trueの間は
  // InviteFormがコード入力フォームを表示し続ける(accept_invite()呼び出しに
  // 必要な情報一式の保持のため必須)。
  awaitingCode?: boolean;
  email?: string;
  token?: string;
  name?: string;
  playerIds?: string;
  agreedTermsVersion?: string;
  agreedTermsAt?: string;
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
  if (!formData.get("agreedTerms")) {
    return { error: "利用規約とプライバシーポリシーへの同意が必要です" };
  }

  const clientIp = await getClientIp();
  const allowed = await checkRateLimit({
    eventType: "invite_accept",
    key: clientIp,
    windowSeconds: 600,
    maxCount: 10,
  });
  if (!allowed) {
    return { error: "リクエストが多すぎます。しばらく時間をおいてから再度お試しください。" };
  }

  const agreedTermsAt = new Date().toISOString();

  const origin = await getRequestOrigin();
  // メール内リンク経由(/auth/confirm→/auth/complete)で確認する場合に備え、
  // 従来通りaccept_invite()に必要な情報一式をクエリパラメータで引き継ぐ。
  // リンクとコードのどちらを使っても確認が完了する(先着した方が有効、
  // 後発は/auth/completeまたは下のverifyInviteCode内で無害なエラーになる)。
  const completeParams = new URLSearchParams({
    kind: "invite",
    token,
    name,
    agreedTermsVersion: CURRENT_TERMS_VERSION,
    agreedTermsAt,
  });
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
      message: "確認メールを送信しました。メールに記載の6桁のコードを入力してください。",
      awaitingCode: true,
      email,
      token,
      name,
      playerIds: playerIds.join(","),
      agreedTermsVersion: CURRENT_TERMS_VERSION,
      agreedTermsAt,
    };
  }

  const { error: rpcError } = await supabase.rpc("accept_invite", {
    invite_token: token,
    member_name: name,
    player_ids: playerIds,
    agreed_terms_version: CURRENT_TERMS_VERSION,
    agreed_terms_at: agreedTermsAt,
  });
  if (rpcError) return { error: rpcError.message };

  redirect("/home");
}

// メール内のリンクではなく、メールに記載された6桁の確認コードをその場で入力して
// 完了させる経路(ネイティブアプリ化時のディープリンク依存を避けるため)。
// /auth/completeが行っていたaccept_invite()呼び出しを、verifyOtp()でセッションが
// 確立された直後にここで直接実行する。
export async function verifyInviteCode(prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? prev.email ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const token = String(formData.get("token") ?? prev.token ?? "");
  const name = String(formData.get("name") ?? prev.name ?? "");
  const playerIds = String(formData.get("playerIds") ?? prev.playerIds ?? "");
  const agreedTermsVersion = String(formData.get("agreedTermsVersion") ?? prev.agreedTermsVersion ?? "");
  const agreedTermsAt = String(formData.get("agreedTermsAt") ?? prev.agreedTermsAt ?? "");

  const carried = { awaitingCode: true as const, email, token, name, playerIds, agreedTermsVersion, agreedTermsAt };

  if (!code) {
    return { ...carried, error: "確認コードを入力してください" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) {
    return { ...carried, error: "コードが正しくないか、有効期限が切れています" };
  }

  const { error: rpcError } = await supabase.rpc("accept_invite", {
    invite_token: token,
    member_name: name,
    player_ids: playerIds.split(",").filter((id) => id !== ""),
    agreed_terms_version: agreedTermsVersion,
    agreed_terms_at: agreedTermsAt,
  });
  if (rpcError && !rpcError.message.includes("既にチームに所属")) {
    return { ...carried, error: rpcError.message };
  }

  redirect("/home");
}

export async function resendInviteCode(prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? prev.email ?? "").trim();
  const carried = {
    awaitingCode: true as const,
    email,
    token: prev.token,
    name: prev.name,
    playerIds: prev.playerIds,
    agreedTermsVersion: prev.agreedTermsVersion,
    agreedTermsAt: prev.agreedTermsAt,
  };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) {
    return { ...carried, error: `再送に失敗しました: ${error.message}` };
  }
  return { ...carried, message: "確認コードを再送しました。" };
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
  redirect("/home");
}
