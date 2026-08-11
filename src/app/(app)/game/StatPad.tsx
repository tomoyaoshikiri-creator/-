"use client";

import { useState } from "react";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { NumChip } from "@/components/ui/Pill";
import { STAT_BUTTONS, fgPct, ftPct, statEventCount, isStatEventAllowed, type StatEvent } from "@/lib/gameStats";
import { playerFullName } from "@/lib/format";
import type { GamePlayerStatLine, Player } from "@/lib/database.types";

// HOOP Jのような「選手を選択→固定位置のスタッツパッドで連続タップ」の操作感に合わせている。
// 選手を選び直さない限り同じ選手に何度でも記録できる。
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
  const selectedPlayer = players.find((p) => p.id === selectedId) ?? null;
  const row = selectedId ? statLines[selectedId] : undefined;

  return (
    <>
      {selectedPlayer ? (
        <Card>
          <div className="flex items-center gap-2.5">
            <NumChip num={selectedPlayer.number ?? "-"} />
            <div className="font-bold text-[14.5px] flex-1">{playerFullName(selectedPlayer)}</div>
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
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-[10px] border border-line bg-paper"
                >
                  <button
                    type="button"
                    onClick={() => canMinus && onTap(selectedPlayer.id, event, -1)}
                    disabled={!canMinus}
                    className="w-7 h-7 flex-none rounded-full border border-line bg-white font-bold text-[14px] text-ink-soft disabled:opacity-30"
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
                    className="w-7 h-7 flex-none rounded-full border border-orange bg-orange text-white font-bold text-[14px]"
                  >
                    ＋
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <EmptyState>下の選手一覧から選手を選んでください</EmptyState>
      )}

      <SectionLabel>選手を選択</SectionLabel>
      <Card>
        {players.length === 0 ? (
          <EmptyState>在籍中の選手がいません</EmptyState>
        ) : (
          players.map((p) => {
            const r = statLines[p.id];
            const active = selectedId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`w-full flex items-center gap-2.5 py-2 px-1.5 -mx-1.5 rounded-lg border-b border-line last:border-b-0 ${
                  active ? "bg-orange/8" : ""
                }`}
              >
                <NumChip num={p.number ?? "-"} />
                <span className={`font-bold text-[13.5px] flex-1 text-left ${active ? "text-orange" : ""}`}>
                  {playerFullName(p)}
                </span>
                <span className="font-mono text-[12.5px] font-bold text-ink-soft">{r?.pts ?? 0}pts</span>
              </button>
            );
          })
        )}
      </Card>
    </>
  );
}
