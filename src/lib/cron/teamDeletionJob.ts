import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const STORAGE_BUCKETS = [
  "team-logos",
  "library-files",
  "notice-attachments",
  "daily-report-attachments",
  "report-attachments",
];
const GRACE_PERIOD_DAYS = 7;

// 退会手続き中(deletion_requested_at設定済み)のチームのうち、猶予期間(7日)を過ぎたものを
// 完全に削除する。Vercel Cronのジョブ数を増やさないため専用cronは作らず、
// /api/cron/attendance-remindersの日次バッチから呼び出す。
// 各Storageバケットは `${teamId}/...` 配下にファイルを置く規約になっており、
// teams行のon delete cascadeはDBの行だけを消しStorageオブジェクトは消さないため、
// teams行を削除する前に該当フォルダを再帰的に空にしておく。
export async function runTeamDeletionSweep(
  supabase: SupabaseClient<Database>,
): Promise<{ deleted: string[]; failed: { teamId: string; error: string }[] }> {
  const cutoff = new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: dueTeams } = await supabase
    .from("teams")
    .select("id")
    .not("deletion_requested_at", "is", null)
    .lte("deletion_requested_at", cutoff);

  const deleted: string[] = [];
  const failed: { teamId: string; error: string }[] = [];

  for (const team of dueTeams ?? []) {
    try {
      for (const bucket of STORAGE_BUCKETS) {
        await removeFolderRecursive(supabase, bucket, team.id);
      }
      const { error } = await supabase.from("teams").delete().eq("id", team.id);
      if (error) throw error;
      deleted.push(team.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ teamId: team.id, error: message });
      console.error(`[cron/team-deletion] failed to delete team ${team.id}`, err);
    }
  }

  return { deleted, failed };
}

// Supabase Storageのlist()はフォルダをid:nullのプレースホルダーエントリとして返すため、
// それを目印に再帰する。
async function removeFolderRecursive(
  supabase: SupabaseClient<Database>,
  bucket: string,
  prefix: string,
): Promise<void> {
  const { data: entries } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (!entries || entries.length === 0) return;

  const files: string[] = [];
  for (const entry of entries) {
    const path = `${prefix}/${entry.name}`;
    if (entry.id === null) {
      await removeFolderRecursive(supabase, bucket, path);
    } else {
      files.push(path);
    }
  }
  if (files.length > 0) {
    await supabase.storage.from(bucket).remove(files);
  }
}
