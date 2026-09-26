import { redirect } from "next/navigation";

// 旧「選手一覧」の着地ページ。選手一覧→カルテ統合により、登録・編集・削除・進級更新を
// 含む全機能が/karte/playersに一本化された。ブックマーク・古いリンク・通知履歴対策として、
// このパスは全ロール共通で/karte/playersへリダイレクトする(/app/(app)/karte/page.tsxと
// 同じ方針)。
export default function PlayersIndexRedirect() {
  redirect("/karte/players");
}
