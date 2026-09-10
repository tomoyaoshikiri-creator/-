// プッシュ通知の送信をベストエフォートで呼び出す共通ヘルパー。呼び出し元の処理(お知らせ登録・
// メモ登録・リアクションなど)は通知の成否を待たない・失敗しても失敗させない(詳細はサーバー側の
// ログ(/api/push/notify)に残る)。
//
// クライアントからは「何が起きたか(eventType)」と「対象の行(refId)」だけを渡す。文面・宛先は
// すべてサーバー側で対象データを引いて組み立てる(任意のtitle/bodyをクライアントから送れない
// ようにするため、A-8)。
export type PushEventType =
  | "notice_created"
  | "notice_reaction"
  | "game_note_created"
  | "game_note_reaction"
  | "player_note_created"
  | "player_note_reaction";

export function sendPushNotification(eventType: PushEventType, refId: string) {
  fetch("/api/push/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, refId }),
  }).catch(() => {});
}
