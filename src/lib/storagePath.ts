// Supabase Storageのキーは日本語などの非ASCII文字を含むとエラーになるため、
// アップロード時のパスは拡張子だけを取り出して安全な名前に組み立てる。
// (ユーザーに見せる元のファイル名は別途DBのfile_name列などに保存する)
export function safeExt(fileName: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  return match ? match[1].toLowerCase() : "bin";
}
