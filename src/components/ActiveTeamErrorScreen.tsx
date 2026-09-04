"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// (app)/layout.tsx がinitialize_active_team()の失敗を検知した際、
// または(auth)/setup がprofileはあるが所属チームを確認できない異常状態を
// 検知した際に、通常のUIの代わりに表示する画面。自動リダイレクトはせず、
// ユーザーの能動的な操作による再ログインを促す。
export function ActiveTeamErrorScreen({
  title = "アクセス状況を確認できませんでした",
  message = "お手数ですが、再度ログインをお試しください。解消しない場合は運営までご連絡ください。",
}: {
  title?: string;
  message?: string;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleRelogin() {
    setLoggingOut(true);
    setLogoutError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("signOut failed", error);
        setLogoutError("ログアウトに失敗しました。もう一度お試しください。");
        setLoggingOut(false);
        return;
      }

      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("signOut threw", err);
      setLogoutError("ログアウトに失敗しました。もう一度お試しください。");
      setLoggingOut(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="flex-1 overflow-y-auto flex flex-col justify-center px-6 py-10">
        <div className="max-w-md mx-auto w-full bg-white border border-line rounded-lg p-5 text-center">
          <div className="font-bold text-[15px] mb-2">{title}</div>
          <div className="text-[12.5px] text-ink-soft leading-relaxed mb-3">{message}</div>
          {logoutError && <div className="mb-3 text-[12.5px] text-danger">{logoutError}</div>}
          <button
            type="button"
            onClick={handleRelogin}
            disabled={loggingOut}
            className="w-full py-2.5 rounded-lg bg-navy text-white font-bold text-[13px] active:opacity-85 disabled:opacity-50"
          >
            {loggingOut ? "処理中…" : "ログインし直す"}
          </button>
        </div>
      </div>
    </div>
  );
}
