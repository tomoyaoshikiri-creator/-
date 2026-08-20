"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SPORTS } from "@/lib/sport";
import { CATEGORIES, isMiniBasketballAllowed } from "@/lib/category";
import type { TeamCategory, TeamSport } from "@/lib/database.types";

export interface FormState {
  error?: string;
}

// メール確認や通信断などで「アカウントはあるがチーム作成が完了しなかった」ユーザーが
// 再度チーム名・管理者名を入力してセットアップを完了するための専用アクション。
// signUp() は行わず、既存セッションに対して create_team_and_admin RPC だけを実行する。
export async function completeSetup(_prev: FormState, formData: FormData): Promise<FormState> {
  const teamName = String(formData.get("teamName") ?? "").trim();
  const adminSei = String(formData.get("adminSei") ?? "").trim();
  const adminMei = String(formData.get("adminMei") ?? "").trim();
  const adminName = `${adminSei}${adminMei}`;
  const category = String(formData.get("category") ?? "") as TeamCategory;
  const sport = String(formData.get("sport") ?? "") as TeamSport;

  if (!teamName || !adminSei || !adminMei) {
    return { error: "すべての項目を入力してください" };
  }
  if (!CATEGORIES.includes(category)) {
    return { error: "カテゴリーを選択してください" };
  }
  if (!SPORTS.includes(sport) || (sport === "ミニバスケットボール" && !isMiniBasketballAllowed(category))) {
    return { error: "競技を選択してください" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("create_team_and_admin", {
    team_name: teamName,
    admin_name: adminName,
    team_sport: sport,
    team_category: category,
  });
  if (error) return { error: error.message };

  redirect("/schedule");
}
