import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";
import type { Database } from "@/lib/database.types";

// 認証・招待系のServer Actionから使う簡易レート制限(C-2)。RLSを経由せず
// service_roleクライアントからcheck_and_increment_rate_limit()を呼ぶ
// (rate_limit_eventsテーブル自体はauthenticated/anonに一切公開しない)。
// SUPABASE_SERVICE_ROLE_KEY未設定・呼び出し失敗時はfail-open(制限しない)とする。
// Web Push/Stripe等の鍵未設定時と同じく、設定不備でサインアップ等の主要機能そのものを
// 止めないための方針。
export async function checkRateLimit(params: {
  eventType: string;
  key: string;
  windowSeconds: number;
  maxCount: number;
}): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return true;

  const adminClient = createSupabaseJsClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await adminClient.rpc("check_and_increment_rate_limit", {
    p_event_type: params.eventType,
    p_key: params.key,
    p_window_seconds: params.windowSeconds,
    p_max_count: params.maxCount,
  });
  if (error) {
    logError(`[rateLimit] check failed for ${params.eventType}, failing open`, error);
    return true;
  }
  return data === true;
}
