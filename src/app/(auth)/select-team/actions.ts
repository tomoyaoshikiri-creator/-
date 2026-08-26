"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface SelectTeamState {
  error?: string;
}

// switch_active_team()は対象team_idが呼び出し元のteam_membershipsに実在することを
// 自身で検証する(SECURITY DEFINER、session_idベースのactive_team_sessionsをUPSERT)。
// 成功時はこの関数自体がredirect()するため、呼び出し元でのnullチェックは不要。
export async function selectTeam(targetTeamId: string): Promise<SelectTeamState | void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("switch_active_team", { target_team_id: targetTeamId });
  if (error) {
    return { error: error.message };
  }
  // (app)/layout.tsxはredirect先(/schedule)と共有されるセグメントのため、明示的に
  // 無効化しないとクライアント側のRouter Cacheに残っている切り替え前のteam情報が
  // redirect後も表示されてしまう。
  revalidatePath("/", "layout");
  redirect("/schedule");
}
