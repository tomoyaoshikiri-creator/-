// Supabase Storageのキーは日本語などの非ASCII文字を含むとエラーになるため、
// アップロード時のパスは拡張子だけを取り出して安全な名前に組み立てる。
// (ユーザーに見せる元のファイル名は別途DBのfile_name列などに保存する)
export function safeExt(fileName: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  return match ? match[1].toLowerCase() : "bin";
}

// 添付資料の「種類」ラベルも日本語のためStorageキーには使えない。
// パス生成専用のASCIIスラッグに変換する(DBのkind列には引き続き日本語のまま保存する)。
export function attachmentKindSlug(kind: string): string {
  switch (kind) {
    case "対戦表":
      return "taisenhyo";
    case "配車表":
      return "haishahyo";
    case "その他":
      return "other";
    default:
      return "attachment";
  }
}
