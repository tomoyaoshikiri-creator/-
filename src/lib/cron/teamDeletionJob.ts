import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// team_id配下にファイルを置く規約の全Storageバケット(src全体でsupabase.storage.from("...")
// している箇所を棚卸しして列挙。新しいバケットを追加したときはここにも追加すること)。
const STORAGE_BUCKETS = [
  "team-logos",
  "library-files",
  "notice-attachments",
  "daily-report-attachments",
  "report-attachments",
  "game-score-photos",
];
const GRACE_PERIOD_DAYS = 7;
const LIST_PAGE_SIZE = 1000; // Supabase Storage list()の1リクエストあたり上限

// 退会手続き中(deletion_requested_at設定済み)のチームのうち、猶予期間(7日)を過ぎたものを
// 完全に削除する。/api/cron/team-deletion(push通知の可否に依存しない専用cron、A-6)から
// 呼び出す。各Storageバケットは `${teamId}/...` 配下にファイルを置く規約になっており、
// teams行のon delete cascadeはDBの行だけを消しStorageオブジェクトは消さないため、
// teams行を削除する前に該当フォルダを再帰的に空にしておく。
export async function runTeamDeletionSweep(
  supabase: SupabaseClient<Database>,
): Promise<{ deleted: string[]; failed: { teamId: string; error: string }[] }> {
  const cutoff = new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: dueTeams } = await supabase
    .from("teams")
    .select("id, deletion_requested_by")
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

      // このチームがサービス退会(A-7)経由で削除申請されていた場合、申請者が
      // 「最後の管理者」として管理していた他のチームがもう残っていなければ
      // (account_deletion_requestsが記録している通り)、ここでアカウント自体を削除する。
      if (team.deletion_requested_by) {
        await finalizeAccountDeletionIfReady(supabase, team.deletion_requested_by);
      }
    } catch (err) {
      // Storage一覧・削除いずれかの失敗もここに伝播する(下のremoveFolderRecursiveが
      // エラーをthrowするため)。このチームは削除完了にせず、次回のcron実行で
      // deletion_requested_atが変わらないままdueTeamsに再度含まれ、リトライされる。
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ teamId: team.id, error: message });
      console.error(`[cron/team-deletion] failed to delete team ${team.id}`, err);
    }
  }

  return { deleted, failed };
}

// account_deletion_requestsに記録が残っているユーザーについて、猶予中だった
// (=最後の管理者として)管理していたチームが他に残っていないか確認し、残っていなければ
// auth.admin.deleteUser()でアカウントを削除する。ここでの失敗はチーム削除自体の成否とは
// 無関係(teams行は既に削除済み)のため、runTeamDeletionSweep側のfailedには含めず、
// ログのみ残す(次にこのユーザーの別のチームが削除されたタイミングで再度試みられるが、
// 該当チームがもう無い場合は次の機会が来ないため、恒久的に残る可能性がある。
// B-1の可観測性整備でアラート対象にする想定)。
async function finalizeAccountDeletionIfReady(supabase: SupabaseClient<Database>, userId: string): Promise<void> {
  try {
    const { data: pending } = await supabase
      .from("account_deletion_requests")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!pending) return;

    const { count } = await supabase
      .from("team_memberships")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) > 0) return; // まだ他に猶予中のチームが残っている

    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;
  } catch (err) {
    console.error(`[cron/team-deletion] failed to finalize account deletion for user ${userId}`, err);
  }
}

// Supabase Storageのlist()はフォルダをid:nullのプレースホルダーエントリとして返すため、
// それを目印に再帰する。1000件を超えるファイルを持つフォルダでも取りこぼさないよう、
// limit到達時はoffsetをずらして次ページを取得し続ける。
async function removeFolderRecursive(
  supabase: SupabaseClient<Database>,
  bucket: string,
  prefix: string,
): Promise<void> {
  const files: string[] = [];
  let offset = 0;
  for (;;) {
    const { data: entries, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: LIST_PAGE_SIZE, offset });
    if (error) throw new Error(`list(${bucket}/${prefix}) failed: ${error.message}`);
    if (!entries || entries.length === 0) break;

    for (const entry of entries) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id === null) {
        await removeFolderRecursive(supabase, bucket, path);
      } else {
        files.push(path);
      }
    }

    if (entries.length < LIST_PAGE_SIZE) break;
    offset += LIST_PAGE_SIZE;
  }

  // removeは1回の呼び出しで大量のpathを渡せるが、1000件区切りでバッチする
  // (list()と同じページサイズに揃え、Storage API側の上限を安全に避ける)。
  for (let i = 0; i < files.length; i += LIST_PAGE_SIZE) {
    const batch = files.slice(i, i + LIST_PAGE_SIZE);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) throw new Error(`remove(${bucket}, ${batch.length}件) failed: ${error.message}`);
  }
}
