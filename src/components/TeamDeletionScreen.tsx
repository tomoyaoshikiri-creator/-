"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatFullDateLabel } from "@/lib/format";

// (app)/layout.tsx がteams.deletion_requested_atを検知した際に、通常のタブUIの
// 代わりに全ロール共通で表示する画面。管理者だけ「退会を取り消す」操作ができる。
export function TeamDeletionScreen({
  isAdmin,
  scheduledDeletionAt,
}: {
  isAdmin: boolean;
  scheduledDeletionAt: string;
}) {
  const router = useRouter();
  const [restoring, setRestoring] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRestore() {
    setRestoring(true);
    setError(null);
    try {
      const res = await fetch("/api/team/cancel-deletion", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "取り消しに失敗しました");
        return;
      }
      router.refresh();
    } catch {
      setError("取り消しに失敗しました");
    } finally {
      setRestoring(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="app-shell">
      <div className="flex-1 overflow-y-auto flex flex-col justify-center px-6 py-10">
        <div className="max-w-md mx-auto w-full bg-white border border-line rounded-2xl p-5 text-center">
          <div className="font-bold text-[15px] mb-2">退会手続き中です</div>
          <div className="text-[12.5px] text-ink-soft leading-relaxed mb-1">
            {formatFullDateLabel(scheduledDeletionAt.slice(0, 10))}に、チームのすべてのデータが完全に削除されます。
          </div>
          {isAdmin ? (
            <>
              <div className="text-[12.5px] text-ink-soft leading-relaxed mt-3 mb-1">
                それまでは「退会を取り消す」からいつでも復旧できます。有料プランをご利用中だった場合、契約は退会申請時点で解約済みのため、取り消し後に改めてお申し込みが必要です。
              </div>
              {error && <div className="mt-3 text-[12.5px] text-danger">{error}</div>}
              <button
                type="button"
                onClick={handleRestore}
                disabled={restoring}
                className="mt-3.5 w-full py-2.5 rounded-[10px] bg-navy text-white font-bold text-[13px] active:opacity-85 disabled:opacity-50"
              >
                {restoring ? "処理中…" : "退会を取り消す"}
              </button>
            </>
          ) : (
            <div className="text-[12.5px] text-ink-soft leading-relaxed mt-3">
              取り消しはチームの管理者のみ行えます。心当たりがない場合は、チームの管理者にご確認ください。
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-3 w-full py-2.5 rounded-[10px] border border-line text-ink-soft font-bold text-[13px] active:opacity-85 disabled:opacity-50"
          >
            {loggingOut ? "処理中…" : "ログアウト"}
          </button>
        </div>
      </div>
    </div>
  );
}
