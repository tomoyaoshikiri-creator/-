"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";

export function CurrentUserBadge() {
  const { name } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-bold text-white bg-white/22 px-2.5 py-1.5 rounded-lg"
      >
        {name}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 bg-white rounded-lg shadow-lg overflow-hidden z-20 min-w-[110px]">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full text-left px-3.5 py-2.5 text-[12.5px] font-bold text-danger"
            >
              {loggingOut ? "処理中…" : "ログアウト"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
