import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type UploadedObjectRef = { bucket: string; path: string };

// 保存操作の途中で失敗した場合に、それまでにStorageへアップロード済みのオブジェクトを
// まとめて削除する。失敗してもconsole.errorに記録するのみで例外は投げない
// (呼び出し元は戻り値のboolean(全件成功したか)を見て、ユーザーへの警告メッセージを出し分ける)。
export async function cleanupUploadedObjects(
  supabase: SupabaseClient<Database>,
  objects: UploadedObjectRef[],
): Promise<boolean> {
  if (objects.length === 0) return true;
  let allOk = true;
  const pathsByBucket = new Map<string, string[]>();
  for (const { bucket, path } of objects) {
    const arr = pathsByBucket.get(bucket) ?? [];
    arr.push(path);
    pathsByBucket.set(bucket, arr);
  }
  for (const [bucket, paths] of pathsByBucket) {
    try {
      const { error } = await supabase.storage.from(bucket).remove(paths);
      if (error) {
        allOk = false;
        console.error(`[storageCleanup] failed to remove orphaned objects (${bucket})`, error, paths);
      }
    } catch (err) {
      allOk = false;
      console.error(`[storageCleanup] unexpected error removing orphaned objects (${bucket})`, err, paths);
    }
  }
  return allOk;
}

type RollbackParentTable = "library_items" | "notices" | "daily_reports" | "reports";

// 新規作成経路(ライブラリ/お知らせ新規/日報/コーチノート)専用のロールバック。
// 本体行が既に作成済みの状態で、添付の処理(アップロード後のINSERT)が失敗した場合に呼ぶ。
// 本体行をdeleteすると、各添付テーブルのFK(on delete cascade)により、
// その時点までに作成済みの添付行も自動的に削除される。
export async function rollbackParentAndObjects(
  supabase: SupabaseClient<Database>,
  params: {
    parentTable: RollbackParentTable;
    parentId: string;
    uploadedObjects: UploadedObjectRef[];
  },
): Promise<boolean> {
  let parentOk = true;
  try {
    const { error } = await supabase.from(params.parentTable).delete().eq("id", params.parentId);
    if (error) {
      parentOk = false;
      console.error(
        `[storageCleanup] failed to rollback parent row (${params.parentTable}/${params.parentId})`,
        error,
      );
    }
  } catch (err) {
    parentOk = false;
    console.error(
      `[storageCleanup] unexpected error rolling back parent row (${params.parentTable}/${params.parentId})`,
      err,
    );
  }
  const objectsOk = await cleanupUploadedObjects(supabase, params.uploadedObjects);
  return parentOk && objectsOk;
}
