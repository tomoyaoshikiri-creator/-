import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { runTeamDeletionSweep } from "@/lib/cron/teamDeletionJob";
import { logError, withCronCheckIn } from "@/lib/logger";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";

// 退会猶予期間(7日)を過ぎたチームの完全削除の専用cron(A-6)。
// 以前は/api/cron/attendance-remindersの日次バッチに同居していたが、そちらはVAPIDキー
// (NEXT_PUBLIC_VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY)未設定時に処理全体を早期returnで
// skipする作りだったため、push通知の設定漏れがチーム削除まで止めてしまう状態だった。
// データ削除はpush通知の成否と無関係であるべきため、専用routeに分離し、
// SUPABASE_SERVICE_ROLE_KEYのみに依存させる。
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    logError("[cron/team-deletion] missing SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  const supabase = createSupabaseJsClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await withCronCheckIn("team-deletion", "30 23 * * *", () => runTeamDeletionSweep(supabase));
  return NextResponse.json({ ok: true, ...result });
}
