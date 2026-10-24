import { redirect } from "next/navigation";

// チーム専用ログインURL(/login/[slug])は廃止し、共通ログイン画面(/login)へ
// リダイレクトする。認証処理自体はもともとslugに依存しておらず(LoginForm/login
// サーバーアクションはどちらのURLでも同一)、見た目もPhase UI-2A以降は共通ログイン画面と
// 同じだったため、動作に影響はない。既存にブックマーク・配布済みのURLが
// 引き続き機能するよう、ルート自体とteams.slugは変更せず残す。
// error/noticeクエリパラメータ(共通ログイン画面が受け取る値)はそのまま引き継ぐ。
export default async function TeamLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;

  const query = new URLSearchParams();
  if (error) query.set("error", error);
  if (notice) query.set("notice", notice);
  const queryString = query.toString();

  redirect(queryString ? `/login?${queryString}` : "/login");
}
