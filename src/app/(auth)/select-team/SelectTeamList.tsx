"use client";

import { useState, useTransition } from "react";
import { selectTeam } from "./actions";

interface Membership {
  team_id: string;
  team_name: string;
  role: string;
  status: string;
}

export function SelectTeamList({ memberships }: { memberships: Membership[] }) {
  const [pending, startTransition] = useTransition();
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSelect(teamId: string) {
    setError(null);
    setSelectingId(teamId);
    startTransition(async () => {
      const result = await selectTeam(teamId);
      if (result?.error) {
        setError(result.error);
        setSelectingId(null);
      }
    });
  }

  return (
    <div className="bg-white border border-line rounded-lg p-2">
      {memberships.map((m) => (
        <button
          key={m.team_id}
          type="button"
          disabled={pending}
          onClick={() => handleSelect(m.team_id)}
          className="w-full flex items-center justify-between px-3 py-3 rounded-lg text-left disabled:opacity-50 border-b border-line last:border-b-0"
        >
          <div>
            <div className="font-bold text-[14px]">{m.team_name}</div>
            <div className="text-[11px] text-ink-soft mt-0.5">{m.role}</div>
          </div>
          <div className="flex-none text-[12px] text-navy font-bold">
            {selectingId === m.team_id && pending ? "選択中…" : "選ぶ"}
          </div>
        </button>
      ))}
      {error && <div className="px-3 pt-2 text-[12.5px] text-danger">{error}</div>}
    </div>
  );
}
