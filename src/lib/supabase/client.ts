import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// createClient()はコンポーネント・ハンドラのあちこちで呼ばれる(100箇所以上)ため、
// 毎回新しいクライアントを作ると認証まわりのタイマー・リスナーが積み重なり、
// 操作を重くする原因になる。ブラウザセッション内では1つのインスタンスを使い回す。
let browserClient: SupabaseClient<Database> | undefined;

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return browserClient;
}
