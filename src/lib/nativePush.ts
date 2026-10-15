import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface NativePushPayload {
  title: string;
  body: string;
  url: string;
}

// ネイティブアプリ(iOS/Android)向けPush通知の送信(ユーザー指示 項目5の準備)。
// APNs/FCMの資格情報(ネイティブラッパー実装時にApple Developer Program・
// Firebaseで用意する)が未設定の環境(このリポジトリの現時点)では、
// device_push_tokensを引く前に即座にスキップする(Stripe/Web Push等、
// 他の「鍵未設定ならskip」と同じ方針)。
//
// 実際の送信実装(apn/firebase-admin等のSDK導入、無効トークンの掃除)は、
// 実機で検証できるようになるネイティブラッパー実装時に行う。呼び出し元
// (/api/push/notify、各種cronの通知送信)は先にここへ配線しておくことで、
// 資格情報を用意するだけで送信が有効になる。
export async function sendNativePush(
  adminClient: SupabaseClient<Database>,
  userIds: string[],
  payload: NativePushPayload,
): Promise<{ sent: number; skipped: boolean }> {
  const apnsConfigured = !!process.env.APNS_KEY_ID && !!process.env.APNS_TEAM_ID && !!process.env.APNS_PRIVATE_KEY;
  const fcmConfigured = !!process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!apnsConfigured && !fcmConfigured) {
    return { sent: 0, skipped: true };
  }
  if (userIds.length === 0) {
    return { sent: 0, skipped: false };
  }

  const { data: tokens } = await adminClient.from("device_push_tokens").select("id, platform, token").in("user_id", userIds);

  // TODO(ネイティブラッパー実装時):
  //   - platform === "ios" → APNs(apnパッケージ等)でpayloadを送信
  //   - platform === "android" → FCM(firebase-admin等)でpayloadを送信
  //   送信失敗(無効化されたトークン)時はdevice_push_tokensから削除する
  //   (push_subscriptionsの404/410時の掃除と同じ考え方)。
  void tokens;
  void payload;
  return { sent: 0, skipped: false };
}
