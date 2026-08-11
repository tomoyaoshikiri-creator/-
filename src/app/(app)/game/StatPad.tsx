"use client";

import { useEffect, useState } from "react";
import { Card, EmptyState } from "@/components/ui/Card";
import { FreeThrowModal } from "./FreeThrowModal";
import {
  STAT_BUTTONS,
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
type GridCell = { type: "ft" } | { type: "stat"; event: StatEvent; label: string };

function statCell(event: StatEvent): GridCell {
  const label = STAT_BUTTONS.find((b) => b.event === event)?.label ?? event;
  return { type: "stat", event, label };
}

const GRID_CELLS: GridCell[] = [
  statCell("fg_make"),
  statCell("fg_miss"),
  statCell("ast"),
  { type: "ft" },
  statCell("fouls"),
  statCell("blk"),
  statCell("tov"),
  statCell("stl"),
  statCell("reb_off"),
  statCell("reb_def"),
];

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
  const [ftModalOpen, setFtModalOpen] = useState(false);

  useEffect(() => {
    if (entrants.length === 0) return;
    if (!selectedId || !entrants.some((e) => e.id === selectedId)) {
      setSelectedId(entrants[0].id);
    }
  }, [entrants, selectedId]);

  useEffect(() => {
    setFtModalOpen(false);
  }, [selectedId]);

  const selected = entrants.find((e) => e.id === selectedId) ?? entrants[0];
  const row = selected ? statLines[selected.id] : undefined;

  function handleSaveFreeThrows(results: boolean[]) {
    if (!selected) return;
    const makes = results.filter(Boolean).length;
    onFreeThrowTrip(selected.id, makes, results.length);
    setFtModalOpen(false);
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
          <div className="grid grid-cols-2 gap-1.5">
            {GRID_CELLS.map((cell) => {
              if (cell.type === "ft") {
                return (
                  <button
                    key="ft"
                    type="button"
                    onClick={() => setFtModalOpen(true)}
                    className="flex flex-col items-center justify-center px-2 py-1.5 rounded-[10px] border border-orange bg-orange/8"
                  >
                    <div className="text-[11px] font-bold text-orange">FT(フリースロー)</div>
                    <div className="font-mono text-[13px] font-bold text-orange">
                      {row?.ft_made ?? 0}/{row?.ft_att ?? 0}
                    </div>
                  </button>
                );
              }
              const { event, label } = cell;
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

      {selected && (
        <FreeThrowModal
          open={ftModalOpen}
          onClose={() => setFtModalOpen(false)}
          entrantLabel={`#${selected.number ?? "-"}${selected.name ? ` ${selected.name}` : ""}`}
          onSave={handleSaveFreeThrows}
        />
      )}
    </>
  );
}
