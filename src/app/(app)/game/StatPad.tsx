"use client";

import { useEffect, useState } from "react";
import { Card, EmptyState } from "@/components/ui/Card";
import {
  STAT_BUTTONS,
  fgPct,
  ftPct,
  statEventCount,
  isStatEventAllowed,
  type StatEvent,
  type StatTotals,
} from "@/lib/gameStats";

export interface StatEntrant {
  id: string;
  number: string | null;
  name: string | null;
}

// 選手チップ(横スクロール)とスタッツパッドを常に同時に表示し、
// 「選手を選ぶ→スクロールしてボタンを探す」という手間をなくして試合中の速さに合わせている。
// 自チーム(選手名あり)・対戦相手(背番号のみ)のどちらでも使える。
export function StatPad({
  entrants,
  statLines,
  onTap,
  emptyMessage = "選手がいません",
}: {
  entrants: StatEntrant[];
  statLines: Record<string, StatTotals>;
  onTap: (entrantId: string, event: StatEvent, delta: number) => void;
  emptyMessage?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (entrants.length === 0) return;
    if (!selectedId || !entrants.some((e) => e.id === selectedId)) {
      setSelectedId(entrants[0].id);
    }
  }, [entrants, selectedId]);

  if (entrants.length === 0) {
    return <EmptyState>{emptyMessage}</EmptyState>;
  }

  const selected = entrants.find((e) => e.id === selectedId) ?? entrants[0];
  const row = statLines[selected.id];

  return (
    <>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {entrants.map((e) => {
          const r = statLines[e.id];
          const active = selected.id === e.id;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => setSelectedId(e.id)}
              className={`flex-none flex flex-col items-center justify-center w-14 h-14 rounded-[12px] border font-bold ${
                active ? "border-orange bg-orange text-white" : "border-line bg-white text-ink"
              }`}
            >
              <span className="text-[15px] leading-none">{e.number ?? "-"}</span>
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
            #{selected.number ?? "-"}
            {selected.name ? ` ${selected.name}` : ""}
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
                  onClick={() => canMinus && onTap(selected.id, event, -1)}
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
                  onClick={() => onTap(selected.id, event, 1)}
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
