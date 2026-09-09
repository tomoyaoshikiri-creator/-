import type { Role } from "./database.types";

// プッシュ通知の送信をベストエフォートで呼び出す共通ヘルパー。呼び出し元の処理(お知らせ登録・
// メモ登録・リアクションなど)は通知の成否を待たない・失敗しても失敗させない(詳細はサーバー側の
// ログ(/api/push/notify)に残る)。
// targetUserIds/targetRolesを指定しない場合はチーム全員(送信者本人を除く)に送られる。
export function sendPushNotification(opts: {
  title: string;
  body?: string;
  url?: string;
  // 特定のuser_idのみに送る(リアクション通知で投稿者だけに送る用途)。
  targetUserIds?: string[];
  // 特定のroleのみに送る(閲覧権限がroleで絞られているコーチメモ/選手メモの登録通知用途)。
  targetRoles?: Role[];
}) {
  fetch("/api/push/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  }).catch(() => {});
}
