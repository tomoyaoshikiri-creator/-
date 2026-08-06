"use client";

import { useSession } from "@/lib/session-context";

export function CurrentUserBadge() {
  const { name } = useSession();
  return (
    <span className="text-xs font-bold text-white bg-white/22 px-2.5 py-1.5 rounded-lg">
      {name}
    </span>
  );
}
