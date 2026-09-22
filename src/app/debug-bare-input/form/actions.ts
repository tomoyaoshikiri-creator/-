"use server";

// 切り分け用テストページ3専用のダミーaction。何もしない。
export async function debugNoopAction(_prev: { ok?: boolean }, _formData: FormData): Promise<{ ok?: boolean }> {
  return { ok: true };
}
