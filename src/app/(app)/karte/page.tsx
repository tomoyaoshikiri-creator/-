import { redirect } from "next/navigation";

// 旧「カルテ」タブの着地ページ。ナビ再設計v3でカルテタブは廃止され、「チーム」hubから
// 各カルテへ直接遷移するようになった。ブックマーク・古いリンク・通知履歴対策として、
// このパスは全ロール共通で /team（チームhub）へリダイレクトする。
export default function KarteIndexRedirect() {
  redirect("/team");
}
