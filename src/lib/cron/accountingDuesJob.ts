import type { SupabaseClient } from "@supabase/supabase-js";
import { generateDuesCharges } from "@/lib/accountingDuesGeneration";
import type { Database } from "@/lib/database.types";

// 集金項目(月謝など)の請求自動生成。全チーム横断で、有効な集金項目を持つチームごとに
// 本日時点で開始済みの集金期間・対象選手の請求を作成する。Vercel Cronのジョブ数を
// 増やさないため、専用のcronは作らず/api/cron/attendance-remindersの日次バッチから
// 呼び出す(ユーザー引き継ぎメモ 3-6 項番1、既存のrunBirthdayRemindersと同じ方針)。
export async function runDuesGeneration(
  supabase: SupabaseClient<Database>,
  todayStr: string,
): Promise<{ teams: number; periodsCreated: number; chargesCreated: number }> {
  const { data: items } = await supabase.from("accounting_dues_items").select("team_id").eq("active", true);
  const teamIds = [...new Set((items ?? []).map((i) => i.team_id))];
  if (teamIds.length === 0) return { teams: 0, periodsCreated: 0, chargesCreated: 0 };

  let periodsCreated = 0;
  let chargesCreated = 0;
  for (const teamId of teamIds) {
    const result = await generateDuesCharges(supabase, teamId, todayStr);
    periodsCreated += result.periodsCreated;
    chargesCreated += result.chargesCreated;
  }
  return { teams: teamIds.length, periodsCreated, chargesCreated };
}
