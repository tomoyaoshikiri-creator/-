"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";

export function CurrentUserBadge() {
  const { name, role } = useSession();
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
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex flex-col items-end gap-0.5 max-w-[140px] px-2.5 py-1.5 rounded-lg"
        style={{ background: "var(--header-chip-surface)", color: "var(--header-chip-on)" }}
      >
        <span className="text-xs font-bold truncate max-w-full">{name}</span>
        <span className="text-[9px] font-medium opacity-80 truncate max-w-full">{role}</span>
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
