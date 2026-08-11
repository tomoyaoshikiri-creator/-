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
// チップの末尾に「交代」ボタンを置き、試合中に発生する途中交代をその場で反映できるようにする。
const GRID_STAT_BUTTONS = STAT_BUTTONS.filter((b) => b.event !== "ft_make" && b.event !== "ft_miss");

export function StatPad({
  entrants,
  statLines,
  onTap,
  onUndo,
  onOpenMemberChange,
  onFreeThrowTrip,
  emptyMessage = "選手がいません",
}: {
  entrants: StatEntrant[];
  statLines: Record<string, StatTotals>;
  onTap: (entrantId: string, event: StatEvent) => void;
  onUndo: (entrantId: string, event: StatEvent) => void;
  onOpenMemberChange?: () => void;
  onFreeThrowTrip: (entrantId: string, makes: number, attempts: number) => void;
  emptyMessage?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ftTripCount, setFtTripCount] = useState<1 | 2 | null>(null);

  useEffect(() => {
    if (entrants.length === 0) return;
    if (!selectedId || !entrants.some((e) => e.id === selectedId)) {
      setSelectedId(entrants[0].id);
    }
  }, [entrants, selectedId]);

  useEffect(() => {
    setFtTripCount(null);
  }, [selectedId]);

  const selected = entrants.find((e) => e.id === selectedId) ?? entrants[0];
  const row = selected ? statLines[selected.id] : undefined;

  function pickFreeThrowOutcome(makes: number, attempts: number) {
    if (!selected) return;
    onFreeThrowTrip(selected.id, makes, attempts);
    setFtTripCount(null);
  }

  return (
    <>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {entrants.map((e) => {
          const r = statLines[e.id];
          const active = selected?.id === e.id;
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
        {onOpenMemberChange && (
          <button
            type="button"
            onClick={onOpenMemberChange}
            className="flex-none flex flex-col items-center justify-center w-14 h-14 rounded-[12px] border border-dashed border-line text-ink-soft font-bold"
          >
            <span className="text-[16px] leading-none">⇄</span>
            <span className="text-[9px] mt-0.5 leading-none">交代</span>
          </button>
        )}
      </div>

      {!selected ? (
        <EmptyState>{emptyMessage}</EmptyState>
      ) : (
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

          <div className="mt-3">
            <div className="text-[10.5px] font-bold text-ink-soft mb-1">フリースロー</div>
            {ftTripCount === null ? (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setFtTripCount(1)}
                  className="flex-1 py-1.5 rounded-[8px] font-bold text-[12px] border border-line text-ink bg-paper"
                >
                  1本
                </button>
                <button
                  type="button"
                  onClick={() => setFtTripCount(2)}
                  className="flex-1 py-1.5 rounded-[8px] font-bold text-[12px] border border-line text-ink bg-paper"
                >
                  2本
                </button>
              </div>
            ) : ftTripCount === 1 ? (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => pickFreeThrowOutcome(1, 1)}
                  className="flex-1 py-1.5 rounded-[8px] font-bold text-[12px] border border-orange bg-orange text-white"
                >
                  成功
                </button>
                <button
                  type="button"
                  onClick={() => pickFreeThrowOutcome(0, 1)}
                  className="flex-1 py-1.5 rounded-[8px] font-bold text-[12px] border border-line text-ink bg-white"
                >
                  失敗
                </button>
                <button
                  type="button"
                  onClick={() => setFtTripCount(null)}
                  className="flex-none px-3 py-1.5 rounded-[8px] font-bold text-[12px] border border-line text-ink-soft bg-white"
                >
                  戻る
                </button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => pickFreeThrowOutcome(2, 2)}
                  className="flex-1 py-1.5 rounded-[8px] font-bold text-[12px] border border-orange bg-orange text-white"
                >
                  2/2
                </button>
                <button
                  type="button"
                  onClick={() => pickFreeThrowOutcome(1, 2)}
                  className="flex-1 py-1.5 rounded-[8px] font-bold text-[12px] border border-line text-ink bg-white"
                >
                  1/2
                </button>
                <button
                  type="button"
                  onClick={() => pickFreeThrowOutcome(0, 2)}
                  className="flex-1 py-1.5 rounded-[8px] font-bold text-[12px] border border-line text-ink bg-white"
                >
                  0/2
                </button>
                <button
                  type="button"
                  onClick={() => setFtTripCount(null)}
                  className="flex-none px-3 py-1.5 rounded-[8px] font-bold text-[12px] border border-line text-ink-soft bg-white"
                >
                  戻る
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 mt-3">
            {GRID_STAT_BUTTONS.map(({ event, label }) => {
              const count = statEventCount(row, event);
              const canMinus = row ? isStatEventAllowed(row, event, -1) : false;
              return (
                <div
                  key={event}
                  className="flex items-center justify-between px-2 py-1.5 rounded-[10px] border border-line bg-paper"
                >
                  <button
                    type="button"
                    onClick={() => canMinus && onUndo(selected.id, event)}
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
                    onClick={() => onTap(selected.id, event)}
                    className="w-8 h-8 flex-none rounded-full border border-orange bg-orange text-white font-bold text-[16px]"
                  >
                    ＋
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}
