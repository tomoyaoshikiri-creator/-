"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { NumChip } from "@/components/ui/Pill";
import { STAT_BUTTONS, fgPct, ftPct, statEventCount, isStatEventAllowed, type StatEvent } from "@/lib/gameStats";
import { playerFullName } from "@/lib/format";
import type { GamePlayerStatLine, Player } from "@/lib/database.types";

export function StatPad({
  players,
  statLines,
  onTap,
}: {
  players: Player[];
  statLines: Record<string, GamePlayerStatLine>;
  onTap: (playerId: string, event: StatEvent, delta: number) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <>
      {players.map((p) => {
        const row = statLines[p.id];
        const expanded = expandedId === p.id;
        return (
          <Card key={p.id} className="cursor-pointer" onClick={() => setExpandedId(expanded ? null : p.id)}>
            <div className="flex items-center gap-2.5">
              <NumChip num={p.number ?? "-"} />
              <div className="font-bold text-[13.5px] flex-1">{playerFullName(p)}</div>
              <div className="font-mono text-[13px] font-bold text-orange">{row?.pts ?? 0}pts</div>
            </div>
            {row && (
              <div className="flex gap-3 mt-1.5 text-[10.5px] text-ink-soft font-mono">
                <span>FG {fgPct(row)}</span>
                <span>FT {ftPct(row)}</span>
                <span>REB {row.reb}</span>
                <span>EFF {row.eff}</span>
              </div>
            )}
            {expanded && (
              <div className="grid grid-cols-2 gap-1.5 mt-3" onClick={(e) => e.stopPropagation()}>
                {STAT_BUTTONS.map(({ event, label }) => {
                  const count = statEventCount(row, event);
                  const canMinus = row ? isStatEventAllowed(row, event, -1) : false;
                  return (
                    <div
                      key={event}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-[10px] border border-line bg-paper"
                    >
                      <button
                        type="button"
                        onClick={() => canMinus && onTap(p.id, event, -1)}
                        disabled={!canMinus}
                        className="w-6 h-6 flex-none rounded-full border border-line bg-white font-bold text-[13px] text-ink-soft disabled:opacity-30"
                      >
                        −
                      </button>
                      <div className="text-center">
                        <div className="text-[11px] font-bold">{label}</div>
                        <div className="font-mono text-[13px] font-bold">{count}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onTap(p.id, event, 1)}
                        className="w-6 h-6 flex-none rounded-full border border-orange bg-orange text-white font-bold text-[13px]"
                      >
                        ＋
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </>
  );
}
