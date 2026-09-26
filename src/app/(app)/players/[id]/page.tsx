import { redirect } from "next/navigation";

// 旧「選手一覧」の選手詳細ページ。選手一覧→カルテ統合により、閲覧・編集・削除を含む
// 全機能が/karte/players/[playerId]に一本化された。ブックマーク・古いリンク・通知履歴
// 対策として、このパスは全ロール共通で対応するカルテの詳細ページへリダイレクトする。
export default async function PlayerDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/karte/players/${id}`);
}
