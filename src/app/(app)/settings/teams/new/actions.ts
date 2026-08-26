"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SPORTS } from "@/lib/sport";
import { CATEGORIES, isMiniBasketballAllowed } from "@/lib/category";
import type { TeamCategory, TeamSport } from "@/lib/database.types";

export interface FormState {
  error?: string;
  switchFailed?: boolean;
}

// 既存ユーザー(2件目以降のチーム作成)専用。create_team_and_admin()は
// has_profile=trueの場合admin_nameを使用しない(profiles.nameは変更しない設計のため)ので、
// このフォームには氏名入力欄がなく、admin_nameは空文字で渡す。
//
// create_team_and_admin()自体は呼び出し元(このアクション)から見て冪等ではない
// (呼ぶたびに新しいチームが作られる)ため、switch_active_team()が失敗しても
// create_team_and_admin()を再実行しない。作成済みチームへの切り替えは
// /select-teamから手動で行えるよう案内するに留める。
export async function createAdditionalTeam(_prev: FormState, formData: FormData): Promise<FormState> {
  const teamName = String(formData.get("teamName") ?? "").trim();
  const category = String(formData.get("category") ?? "") as TeamCategory;
  const sport = String(formData.get("sport") ?? "") as TeamSport;

  if (!teamName) {
    return { error: "チーム名を入力してください" };
  }
  if (!CATEGORIES.includes(category)) {
    return { error: "カテゴリーを選択してください" };
  }
  if (!SPORTS.includes(sport) || (sport === "ミニバスケットボール" && !isMiniBasketballAllowed(category))) {
    return { error: "競技を選択してください" };
  }

  const supabase = await createClient();

  const { data: newTeamId, error: createError } = await supabase.rpc("create_team_and_admin", {
    team_name: teamName,
    admin_name: "",
    team_sport: sport,
    team_category: category,
  });
  if (createError) return { error: createError.message };
  if (!newTeamId) return { error: "チームの作成に失敗しました" };

  const { error: switchError } = await supabase.rpc("switch_active_team", { target_team_id: newTeamId });
  if (switchError) {
    return { switchFailed: true };
  }

  // (app)/layout.tsxはredirect先(/schedule)と直前のページ(/settings/teams/new)で
  // 共有されるセグメントのため、明示的に無効化しないとクライアント側のRouter Cacheに
  // 残っている切り替え前のteam情報がredirect後も表示されてしまう。
  revalidatePath("/", "layout");
  redirect("/schedule");
}
