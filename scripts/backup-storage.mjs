// 日次バックアップ(.github/workflows/db-backup.yml)用。
// Supabase Storageの全バケット・全ファイルをbackup/storage/配下にダウンロードする。
// データベース本体(テーブルの行データ)はpg_dumpが別途担当するため、
// このスクリプトはStorageのファイル(写真・添付資料等)のみを対象にする。
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

// GitHub Actions Secretsへの登録時、コピー&ペースト由来の前後の空白・改行が
// 紛れ込むことがあるため、念のためtrimしておく(混入しているとURLの構築が
// 壊れ、どのAPI呼び出しも「Invalid path specified in request URL」で
// 失敗する)。
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey);
const outDir = path.join(process.cwd(), "backup", "storage");

async function downloadFolder(bucketName, folderPath) {
  const { data: entries, error } = await supabase.storage.from(bucketName).list(folderPath, { limit: 1000 });
  if (error) {
    console.error(`skip listing ${bucketName}/${folderPath}: ${error.message}`);
    return;
  }

  for (const entry of entries ?? []) {
    const entryPath = folderPath ? `${folderPath}/${entry.name}` : entry.name;
    // Storageの一覧APIはフォルダを擬似ディレクトリ(id無し)として返すため、それを目印に
    // 再帰する。APIのバージョンによってidがnullではなくundefinedの場合もあるため、
    // 厳密な===nullではなく!entry.idで判定する。
    if (!entry.id) {
      await downloadFolder(bucketName, entryPath);
      continue;
    }
    const { data: blob, error: downloadError } = await supabase.storage.from(bucketName).download(entryPath);
    if (downloadError) {
      console.error(`skip ${bucketName}/${entryPath}: ${downloadError.message}`);
      continue;
    }
    const destPath = path.join(outDir, bucketName, entryPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, Buffer.from(await blob.arrayBuffer()));
  }
}

async function run() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  for (const bucket of buckets) {
    await downloadFolder(bucket.name, "");
  }
}

run()
  .then(() => console.log("storage backup done"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
