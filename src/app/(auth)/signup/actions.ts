"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/origin";
import { SPORTS } from "@/lib/sport";
import { CATEGORIES, isMiniBasketballAllowed } from "@/lib/category";
import type { TeamCategory, TeamSport } from "@/lib/database.types";

export interface FormState {
  error?: string;
  message?: string;
}

export async function signUpTeam(_prev: FormState, formData: FormData): Promise<FormState> {
  const teamName = String(formData.get("teamName") ?? "").trim();
  const adminSei = String(formData.get("adminSei") ?? "").trim();
  const adminMei = String(formData.get("adminMei") ?? "").trim();
  const adminName = `${adminSei}${adminMei}`;
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const category = String(formData.get("category") ?? "") as TeamCategory;
  const sport = String(formData.get("sport") ?? "") as TeamSport;

  if (!teamName || !adminSei || !adminMei || !email || !password) {
    return { error: "すべての項目を入力してください" };
  }
  if (password.length < 8) {
    return { error: "パスワードは8文字以上で入力してください" };
  }
  if (!CATEGORIES.includes(category)) {
    return { error: "カテゴリーを選択してください" };
  }
  if (!SPORTS.includes(sport) || (sport === "ミニバスケットボール" && !isMiniBasketballAllowed(category))) {
    return { error: "競技を選択してください" };
  }

  const origin = await getRequestOrigin();
  const completeParams = new URLSearchParams({ kind: "team", teamName, adminName, category, sport });
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

  const { error: rpcError } = await supabase.rpc("create_team_and_admin", {
    team_name: teamName,
    admin_name: adminName,
    team_sport: sport,
    team_category: category,
  });
  if (rpcError) return { error: rpcError.message };

  redirect("/schedule");
}
