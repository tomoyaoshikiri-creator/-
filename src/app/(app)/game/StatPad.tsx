"use client";

import { useEffect, useState } from "react";
import { Card, EmptyState } from "@/components/ui/Card";
import { STAT_BUTTONS, fgPct, ftPct, statEventCount, isStatEventAllowed, type StatEvent } from "@/lib/gameStats";
import { playerFullName } from "@/lib/format";
import type { GamePlayerStatLine, Player } from "@/lib/database.types";

// 選手チップ(横スクロール)とスタッツパッドを常に同時に表示し、
// 「選手を選ぶ→スクロールしてボタンを探す」という手間をなくして試合中の速さに合わせている。
export function StatPad({
  players,
  statLines,
  onTap,
}: {
  players: Player[];
  statLines: Record<string, GamePlayerStatLine>;
  onTap: (playerId: string, event: StatEvent, delta: number) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (players.length === 0) return;
    if (!selectedId || !players.some((p) => p.id === selectedId)) {
      setSelectedId(players[0].id);
    }
  }, [players, selectedId]);

  if (players.length === 0) {
    return <EmptyState>在籍中の選手がいません</EmptyState>;
  }

  const selectedPlayer = players.find((p) => p.id === selectedId) ?? players[0];
  const row = statLines[selectedPlayer.id];

  return (
    <>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {players.map((p) => {
          const r = statLines[p.id];
          const active = selectedPlayer.id === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className={`flex-none flex flex-col items-center justify-center w-14 h-14 rounded-[12px] border font-bold ${
                active ? "border-orange bg-orange text-white" : "border-line bg-white text-ink"
              }`}
            >
              <span className="text-[15px] leading-none">{p.number ?? "-"}</span>
              <span className={`text-[9.5px] mt-0.5 leading-none ${active ? "text-white/85" : "text-ink-soft"}`}>
                {r?.pts ?? 0}pts
              </span>
            </button>
          );
        })}
      </div>

      <Card className="mt-2">
        <div className="flex items-center gap-2.5">
          <div className="font-bold text-[14.5px] flex-1">
            #{selectedPlayer.number ?? "-"} {playerFullName(selectedPlayer)}
          </div>
          <div className="font-mono text-[15px] font-bold text-orange">{row?.pts ?? 0}pts</div>
        </div>
        <div className="flex gap-3 mt-1.5 text-[10.5px] text-ink-soft font-mono">
          <span>FG {fgPct(row)}</span>
          <span>FT {ftPct(row)}</span>
          <span>REB {row?.reb ?? 0}</span>
          <span>EFF {row?.eff ?? 0}</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mt-3">
          {STAT_BUTTONS.map(({ event, label }) => {
            const count = statEventCount(row, event);
            const canMinus = row ? isStatEventAllowed(row, event, -1) : false;
            return (
              <div
                key={event}
                className="flex items-center justify-between px-2 py-1.5 rounded-[10px] border border-line bg-paper"
              >
                <button
                  type="button"
                  onClick={() => canMinus && onTap(selectedPlayer.id, event, -1)}
                  disabled={!canMinus}
                  className="w-8 h-8 flex-none rounded-full border border-line bg-white font-bold text-[16px] text-ink-soft disabled:opacity-30"
                >
                  −
                </button>
                <div className="text-center">
                  <div className="text-[11px] font-bold">{label}</div>
                  <div className="font-mono text-[13px] font-bold">{count}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onTap(selectedPlayer.id, event, 1)}
                  className="w-8 h-8 flex-none rounded-full border border-orange bg-orange text-white font-bold text-[16px]"
                >
                  ＋
                </button>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
