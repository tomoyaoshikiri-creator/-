"use server";

// 切り分け用テストページ専用のダミーaction。何もしない。原因特定後に削除する。
export async function debugNoopAction(_prev: { ok?: boolean }, _formData: FormData): Promise<{ ok?: boolean }> {
  return { ok: true };
}
