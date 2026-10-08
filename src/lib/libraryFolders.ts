import type { LibraryFolder } from "@/lib/database.types";

// 現在のフォルダからルートまでのパス(パンくず用)。ルート直下なら空配列。
export function folderPath(folders: LibraryFolder[], folderId: string | null): LibraryFolder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: LibraryFolder[] = [];
  let cursor = folderId ? byId.get(folderId) : undefined;
  while (cursor) {
    path.unshift(cursor);
    cursor = cursor.parent_folder_id ? byId.get(cursor.parent_folder_id) : undefined;
  }
  return path;
}

// 指定した親の直下にあるフォルダ一覧(名前順)。
export function childFolders(folders: LibraryFolder[], parentId: string | null): LibraryFolder[] {
  return folders.filter((f) => f.parent_folder_id === parentId).sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

// candidateがancestorの子孫(直下含む)かどうか。移動先ピッカーで、移動対象フォルダ
// 自身とその子孫を選択肢から除外するために使う(DBトリガーの循環防止はこれとは別に存在する保険)。
export function isDescendantOf(folders: LibraryFolder[], candidateId: string, ancestorId: string): boolean {
  const byId = new Map(folders.map((f) => [f.id, f]));
  let cursor = byId.get(candidateId);
  while (cursor) {
    if (cursor.parent_folder_id === ancestorId) return true;
    cursor = cursor.parent_folder_id ? byId.get(cursor.parent_folder_id) : undefined;
  }
  return false;
}
