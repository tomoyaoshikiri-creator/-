import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Storageへのアップロードは成功したが、直後のDB行の登録(insert)が失敗した場合に
// アップロード済みのオブジェクトを削除する後始末。失敗してもconsole.errorに記録するのみで、
// 呼び出し元が表示する本来のエラー(insert失敗のトースト)は上書き・握り潰さない。
export async function removeUploadedObject(
  supabase: SupabaseClient<Database>,
  bucket: string,
  path: string,
): Promise<void> {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      console.error(`[storageCleanup] failed to remove orphaned object (${bucket}/${path})`, error);
    }
  } catch (err) {
    console.error(`[storageCleanup] unexpected error removing orphaned object (${bucket}/${path})`, err);
  }
}
