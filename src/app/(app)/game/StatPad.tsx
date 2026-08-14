"use client";

import { useEffect, useState } from "react";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
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

type Side = "own" | "opponent";

// 自チーム・相手チームで別々のスタッツパッドを持たせず、選手チップ(上=自チーム/下=相手チーム)で
// スタッツボタンを挟み込み、1つのボタン列を両チーム共有にする。
// タップされたチップ(どちらのチームか)に応じて、共有ボタンの加算先だけが切り替わる。
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
  statCell("blk"),
  statCell("fouls"),
  statCell("stl"),
  statCell("tov"),
  statCell("reb_off"),
  statCell("reb_def"),
];

function ChipRow({
  entrants,
  statLines,
  active,
  activeColor = "orange",
  showName = false,
  onSelect,
  onOpenMemberChange,
}: {
  entrants: StatEntrant[];
  statLines: Record<string, StatTotals>;
  active: (id: string) => boolean;
  activeColor?: "orange" | "navy";
  showName?: boolean;
  onSelect: (id: string) => void;
  onOpenMemberChange?: () => void;
}) {
  const activeClass = activeColor === "navy" ? "border-navy bg-navy text-white" : "border-orange bg-orange text-white";
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {entrants.map((e) => {
        const r = statLines[e.id];
        const isActive = active(e.id);
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => onSelect(e.id)}
            className={`flex-none flex flex-col items-center justify-center w-14 ${showName ? "h-16" : "h-14"} rounded-[12px] border font-bold ${
              isActive ? activeClass : "border-line bg-white text-ink"
            }`}
          >
            {showName && e.name && (
              <span
                className={`w-full px-0.5 text-[8px] leading-none truncate text-center ${
                  isActive ? "text-white/85" : "text-ink-soft"
                }`}
              >
                {e.name}
              </span>
            )}
            <span className="text-[15px] leading-none mt-0.5">{e.number ?? "-"}</span>
            <span className={`text-[9.5px] mt-0.5 leading-none ${isActive ? "text-white/85" : "text-ink-soft"}`}>
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
  );
}

export function StatPad({
  ownEntrants,
  ownStatLines,
  onOwnTap,
  onOwnUndo,
  onOwnFreeThrowTrip,
  onOpenOwnMemberChange,
  opponentEntrants,
  opponentStatLines,
  onOpponentTap,
  onOpponentUndo,
  onOpponentFreeThrowTrip,
  onOpenOpponentMemberChange,
}: {
  ownEntrants: StatEntrant[];
  ownStatLines: Record<string, StatTotals>;
  onOwnTap: (entrantId: string, event: StatEvent) => void;
  onOwnUndo: (entrantId: string, event: StatEvent) => void;
  onOwnFreeThrowTrip: (entrantId: string, makes: number, attempts: number) => void;
  onOpenOwnMemberChange: () => void;
  opponentEntrants: StatEntrant[];
  opponentStatLines: Record<string, StatTotals>;
  onOpponentTap: (entrantId: string, event: StatEvent) => void;
  onOpponentUndo: (entrantId: string, event: StatEvent) => void;
  onOpponentFreeThrowTrip: (entrantId: string, makes: number, attempts: number) => void;
  onOpenOpponentMemberChange: () => void;
}) {
  const [selected, setSelected] = useState<{ side: Side; id: string } | null>(null);
  const [ftModalOpen, setFtModalOpen] = useState(false);

  useEffect(() => {
    if (selected) {
      const list = selected.side === "own" ? ownEntrants : opponentEntrants;
      if (list.some((e) => e.id === selected.id)) return;
    }
    if (ownEntrants.length > 0) {
      setSelected({ side: "own", id: ownEntrants[0].id });
    } else if (opponentEntrants.length > 0) {
      setSelected({ side: "opponent", id: opponentEntrants[0].id });
    } else {
      setSelected(null);
    }
  }, [ownEntrants, opponentEntrants, selected]);

  useEffect(() => {
    setFtModalOpen(false);
  }, [selected]);

  const entrants = selected?.side === "own" ? ownEntrants : opponentEntrants;
  const selectedEntrant = selected ? entrants.find((e) => e.id === selected.id) : undefined;
  const statLines = selected?.side === "own" ? ownStatLines : opponentStatLines;
  const row = selectedEntrant ? statLines[selectedEntrant.id] : undefined;
  const onTap = selected?.side === "own" ? onOwnTap : onOpponentTap;
  const onUndo = selected?.side === "own" ? onOwnUndo : onOpponentUndo;
  const onFreeThrowTrip = selected?.side === "own" ? onOwnFreeThrowTrip : onOpponentFreeThrowTrip;

  function handleSaveFreeThrows(results: boolean[]) {
    if (!selectedEntrant) return;
    const makes = results.filter(Boolean).length;
    onFreeThrowTrip(selectedEntrant.id, makes, results.length);
    setFtModalOpen(false);
  }

  return (
    <>
      <SectionLabel>自チームのスタッツ</SectionLabel>
      <ChipRow
        entrants={ownEntrants}
        statLines={ownStatLines}
        active={(id) => selected?.side === "own" && selected.id === id}
        showName
        onSelect={(id) => setSelected({ side: "own", id })}
        onOpenMemberChange={onOpenOwnMemberChange}
      />

      {!selectedEntrant ? (
        <EmptyState>スタメンを登録するか、交代ボタンから選手を選んでください</EmptyState>
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
                    className="flex flex-col items-center justify-center px-2 py-1.5 rounded-[10px] border border-line bg-paper"
                  >
                    <div className="text-[11px] font-bold">FT(フリースロー)</div>
                    <div className="font-mono text-[13px] font-bold">
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
                    onClick={() => canMinus && onUndo(selectedEntrant.id, event)}
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
                    onClick={() => onTap(selectedEntrant.id, event)}
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

      <div className="mt-2">
        <ChipRow
          entrants={opponentEntrants}
          statLines={opponentStatLines}
          active={(id) => selected?.side === "opponent" && selected.id === id}
          activeColor="navy"
          onSelect={(id) => setSelected({ side: "opponent", id })}
          onOpenMemberChange={onOpenOpponentMemberChange}
        />
        <SectionLabel align="right">相手チームのスタッツ</SectionLabel>
      </div>

      {selectedEntrant && (
        <FreeThrowModal
          open={ftModalOpen}
          onClose={() => setFtModalOpen(false)}
          entrantLabel={`#${selectedEntrant.number ?? "-"}${selectedEntrant.name ? ` ${selectedEntrant.name}` : ""}`}
          onSave={handleSaveFreeThrows}
        />
      )}
    </>
  );
}
