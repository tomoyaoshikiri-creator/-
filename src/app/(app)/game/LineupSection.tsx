"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { Card, EmptyState } from "@/components/ui/Card";
import { NumChip } from "@/components/ui/Pill";
import { SubmitButton, FieldLabel } from "@/components/ui/SegButton";
import { playerFullName } from "@/lib/format";
import type { AttendanceStatus, Player } from "@/lib/database.types";

function PlayerCheckRow({
  player,
  checked,
  absent,
  dimmed,
  onToggle,
}: {
  player: Player;
  checked: boolean;
  absent?: boolean;
  dimmed?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-2.5 py-2 px-2 -mx-2 rounded-lg border-b border-line last:border-b-0 text-left ${
        absent || dimmed ? "opacity-40" : ""
      } ${checked ? "bg-orange/10" : ""}`}
    >
      <NumChip num={player.number ?? "-"} />
      <div className={`font-bold text-[13.5px] ${checked ? "text-orange" : ""}`}>{playerFullName(player)}</div>
      {absent && <span className="text-[10px] font-bold" style={{ color: "var(--danger)" }}>欠席</span>}
    </button>
  );
}

// クォーターごとのスタメン(最大5人)だけを登録する。途中交代はここでは扱わず、
// スタッツ入力画面の「メンバーチェンジ」から行う(試合中に発生するため)。
export function LineupSection({
  starters,
  saving,
  players,
  attendanceStatus,
  onSaveStarters,
}: {
  starters: string[];
  saving: boolean;
  players: Player[];
  attendanceStatus: Record<string, AttendanceStatus>;
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
        <FieldLabel>スターティング(最大5人)</FieldLabel>
        <Card>
          {players.length === 0 ? (
            <EmptyState>在籍中の選手がいません</EmptyState>
          ) : (
            players.map((p) => (
              <PlayerCheckRow
                key={p.id}
                player={p}
                checked={draft.includes(p.id)}
                absent={attendanceStatus[p.id] === "欠席"}
                dimmed={draft.length >= 5 && !draft.includes(p.id)}
                onToggle={() => toggleDraft(p.id)}
              />
            ))
          )}
        </Card>
      </div>

      <SubmitButton onClick={handleSave} disabled={saving || players.length === 0}>
        {saving ? "登録中…" : "スターティングを登録する"}
      </SubmitButton>
    </>
  );
}
