"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { Card, EmptyState } from "@/components/ui/Card";
import { SubmitButton, FieldLabel } from "@/components/ui/SegButton";
import type { GameOpponentPlayer } from "@/lib/database.types";

function OpponentCheckRow({
  opponentPlayer,
  checked,
  dimmed,
  onToggle,
}: {
  opponentPlayer: GameOpponentPlayer;
  checked: boolean;
  dimmed?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-2.5 py-2 px-2 -mx-2 rounded-lg border-b border-line last:border-b-0 text-left ${
        dimmed ? "opacity-40" : ""
      } ${checked ? "bg-orange/10" : ""}`}
    >
      <div className={`font-mono font-bold text-[13.5px] ${checked ? "text-orange" : ""}`}>
        #{opponentPlayer.number}
      </div>
    </button>
  );
}

// クォーターごとの相手チームのスタメン(最大5人)だけを、登録済みの背番号ロースターから選ぶ。
// 自チームのLineupSectionと同じ考え方(途中交代はメンバーチェンジから行う)。
export function OpponentLineupSection({
  opponentPlayers,
  starters,
  saving,
  onSaveStarters,
}: {
  opponentPlayers: GameOpponentPlayer[];
  starters: string[];
  saving: boolean;
  onSaveStarters: (starters: string[]) => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<string[]>(starters);

  useEffect(() => {
    setDraft(starters);
  }, [starters]);

  function toggleDraft(id: string) {
    const isActive = draft.includes(id);
    if (!isActive && draft.length >= 5) {
      toast("スターティングは5人までです");
      return;
    }
    setDraft(isActive ? draft.filter((x) => x !== id) : [...draft, id]);
  }

  function handleSave() {
    onSaveStarters(draft);
  }

  return (
    <>
      <div className="mt-3">
        <FieldLabel>相手スターティング(最大5人)</FieldLabel>
        <Card>
          {opponentPlayers.length === 0 ? (
            <EmptyState>まず背番号を登録してください</EmptyState>
          ) : (
            opponentPlayers.map((p) => (
              <OpponentCheckRow
                key={p.id}
                opponentPlayer={p}
                checked={draft.includes(p.id)}
                dimmed={draft.length >= 5 && !draft.includes(p.id)}
                onToggle={() => toggleDraft(p.id)}
              />
            ))
          )}
        </Card>
      </div>

      <SubmitButton onClick={handleSave} disabled={saving || opponentPlayers.length === 0}>
        {saving ? "登録中…" : "相手スターティングを登録する"}
      </SubmitButton>
    </>
  );
}
