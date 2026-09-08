"use client";

import { useEffect, useState } from "react";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { useSession } from "@/lib/session-context";
import { usesThreePointScoring } from "@/lib/sport";
import { FreeThrowModal } from "./FreeThrowModal";
import { STAT_BUTTONS, statEventCount, type StatEvent, type StatTotals } from "@/lib/gameStats";
import type { GameStatEvent, GameOpponentStatEvent, GameTimeoutEvent } from "@/lib/database.types";

export interface StatEntrant {
  id: string;
  number: string | null;
  name: string | null;
}

type Side = "own" | "opponent";

// 自チーム・相手チームで別々のスタッツパッドを持たせず、選手チップ(上=自チーム/下=相手チーム)で
// スタッツボタンを挟み込み、1つのボタン列を両チーム共有にする。
// タップされたチップ(どちらのチームか)に応じて、共有ボタンの加算先だけが切り替わる。
export type GridCell = { type: "ft" } | { type: "stat"; event: StatEvent; label: string };

function statCell(event: StatEvent): GridCell {
  const label = STAT_BUTTONS.find((b) => b.event === event)?.label ?? event;
  return { type: "stat", event, label };
}

const BASE_GRID_CELLS: GridCell[] = [
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

// バスケットボール(usesThreePointScoring(sport)がtrue)のときだけ、2P成功/失敗の直後に
// 3P成功/失敗のマスを挿入する。ミニバスケットボールでは今まで通りBASE_GRID_CELLSのまま。
const THREE_POINT_CELLS: GridCell[] = [statCell("three_make"), statCell("three_miss")];

export function buildGridCells(showThreePoint: boolean): GridCell[] {
  if (!showThreePoint) return BASE_GRID_CELLS;
  return [BASE_GRID_CELLS[0], BASE_GRID_CELLS[1], ...THREE_POINT_CELLS, ...BASE_GRID_CELLS.slice(2)];
}

// SectionLabelのactionスロットに置く、チーム単位のタイムアウト記録ボタン。
// 選手の選択状態に関わらず常にタップでき、その場でクォーターのタイムアウト回数を1つ記録する。
function TimeoutButton({
  color,
  count,
  onTap,
}: {
  color: "orange" | "navy";
  count: number;
  onTap: () => void;
}) {
  const colorClass = color === "navy" ? "border-navy text-navy" : "border-orange text-orange";
  return (
    <button
      type="button"
      onClick={onTap}
      className={`flex-none normal-case tracking-normal px-2.5 py-1 rounded-lg border bg-white font-bold text-[11px] ${colorClass}`}
    >
      ⏱ タイムアウト{count > 0 ? ` ${count}` : ""}
    </button>
  );
}

function ChipRow({
  entrants,
  statLines,
  active,
  activeColor = "orange",
  showName = false,
  onSelect,
  onOpenMemberChange,
  onUndo,
  canUndo,
}: {
  entrants: StatEntrant[];
  statLines: Record<string, StatTotals>;
  active: (id: string) => boolean;
  activeColor?: "orange" | "navy";
  showName?: boolean;
  onSelect: (id: string) => void;
  onOpenMemberChange?: () => void;
  // 直前の記録を1件取り消す(チーム共通の操作)。渡された側の交代ボタンの
  // すぐ下に、交代ボタンと同じ大きさで並べて配置する。
  onUndo?: () => void;
  canUndo?: boolean;
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
            className={`flex-none flex flex-col items-center justify-center w-14 ${showName ? "h-16" : "h-14"} rounded-lg border font-bold ${
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
        <div className="flex-none w-14 h-14 flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onOpenMemberChange}
            className="flex-1 min-h-0 flex flex-col items-center justify-center rounded-lg border border-dashed border-line text-ink-soft font-bold"
          >
            <span className="text-[12px] leading-none">⇄</span>
            <span className="text-[7px] mt-0.5 leading-none">交代</span>
          </button>
          {onUndo && (
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className={`flex-1 min-h-0 flex items-center justify-center rounded-lg border border-dashed border-danger text-danger font-bold text-[8.5px] ${
                canUndo ? "" : "opacity-40"
              }`}
            >
              取消
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function StatPad({
  quarter,
  ownEntrants,
  ownStatLines,
  ownStatEvents,
  onOwnTap,
  onOwnFreeThrowTrip,
  onOpenOwnMemberChange,
  opponentEntrants,
  opponentStatLines,
  opponentStatEvents,
  onOpponentTap,
  onOpponentFreeThrowTrip,
  onOpenOpponentMemberChange,
  onDeleteStatEvent,
  onDeleteOpponentStatEvent,
  timeoutEvents,
  onOwnTimeout,
  onOpponentTimeout,
  onDeleteTimeoutEvent,
}: {
  quarter: number;
  ownEntrants: StatEntrant[];
  ownStatLines: Record<string, StatTotals>;
  ownStatEvents: GameStatEvent[];
  onOwnTap: (entrantId: string, event: StatEvent) => void;
  onOwnFreeThrowTrip: (entrantId: string, makes: number, attempts: number) => void;
  onOpenOwnMemberChange: () => void;
  opponentEntrants: StatEntrant[];
  opponentStatLines: Record<string, StatTotals>;
  opponentStatEvents: GameOpponentStatEvent[];
  onOpponentTap: (entrantId: string, event: StatEvent) => void;
  onOpponentFreeThrowTrip: (entrantId: string, makes: number, attempts: number) => void;
  onOpenOpponentMemberChange: () => void;
  onDeleteStatEvent: (eventId: string) => Promise<void>;
  onDeleteOpponentStatEvent: (eventId: string) => Promise<void>;
  timeoutEvents: GameTimeoutEvent[];
  onOwnTimeout: () => void;
  onOpponentTimeout: () => void;
  onDeleteTimeoutEvent: (eventId: string) => Promise<void>;
}) {
  const { sport } = useSession();
  const gridCells = buildGridCells(usesThreePointScoring(sport));
  const [selected, setSelected] = useState<{ side: Side; id: string } | null>(null);
  const [ftModalOpen, setFtModalOpen] = useState(false);

  // 選択中の選手がスタメン/途中出場から外れた場合だけ選択を解除する。
  // タップのたびに次の選手を自動選択することはせず、毎回選び直してもらう。
  useEffect(() => {
    if (!selected) return;
    const list = selected.side === "own" ? ownEntrants : opponentEntrants;
    if (!list.some((e) => e.id === selected.id)) setSelected(null);
  }, [ownEntrants, opponentEntrants, selected]);

  useEffect(() => {
    setFtModalOpen(false);
  }, [selected]);

  const entrants = selected?.side === "own" ? ownEntrants : opponentEntrants;
  const selectedEntrant = selected ? entrants.find((e) => e.id === selected.id) : undefined;
  const statLines = selected?.side === "own" ? ownStatLines : opponentStatLines;
  const row = selectedEntrant ? statLines[selectedEntrant.id] : undefined;
  const onTap = selected?.side === "own" ? onOwnTap : onOpponentTap;
  const onFreeThrowTrip = selected?.side === "own" ? onOwnFreeThrowTrip : onOpponentFreeThrowTrip;

  function handleTap(event: StatEvent) {
    if (!selectedEntrant) return;
    onTap(selectedEntrant.id, event);
    setSelected(null);
  }

  function handleSaveFreeThrows(results: boolean[]) {
    if (!selectedEntrant) return;
    const makes = results.filter(Boolean).length;
    onFreeThrowTrip(selectedEntrant.id, makes, results.length);
    setFtModalOpen(false);
    setSelected(null);
  }

  // 選手選択の有無にかかわらず、自チーム・相手チームのスタッツ+タイムアウトを通じて
  // 直前に記録された1件を取り消す。各イベント配列は作成日時の降順で読み込まれている前提で、
  // それぞれの先頭同士を比較する。
  const ownLast = ownStatEvents.find((e) => e.quarter === quarter);
  const opponentLast = opponentStatEvents.find((e) => e.quarter === quarter);
  const ownTimeoutLast = timeoutEvents.find((e) => e.side === "own" && e.quarter === quarter);
  const opponentTimeoutLast = timeoutEvents.find((e) => e.side === "opponent" && e.quarter === quarter);

  type LastEntry = { kind: "stat" | "timeout"; side: Side; id: string; createdAt: string };
  const undoCandidates: LastEntry[] = [
    ownLast && { kind: "stat" as const, side: "own" as const, id: ownLast.id, createdAt: ownLast.created_at },
    opponentLast && {
      kind: "stat" as const,
      side: "opponent" as const,
      id: opponentLast.id,
      createdAt: opponentLast.created_at,
    },
    ownTimeoutLast && {
      kind: "timeout" as const,
      side: "own" as const,
      id: ownTimeoutLast.id,
      createdAt: ownTimeoutLast.created_at,
    },
    opponentTimeoutLast && {
      kind: "timeout" as const,
      side: "opponent" as const,
      id: opponentTimeoutLast.id,
      createdAt: opponentTimeoutLast.created_at,
    },
  ].filter((x): x is LastEntry => !!x);
  const lastEntry =
    undoCandidates.length === 0
      ? null
      : undoCandidates.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b));

  async function handleUndo() {
    if (!lastEntry) return;
    if (lastEntry.kind === "timeout") await onDeleteTimeoutEvent(lastEntry.id);
    else if (lastEntry.side === "own") await onDeleteStatEvent(lastEntry.id);
    else await onDeleteOpponentStatEvent(lastEntry.id);
  }

  const ownTimeoutCount = timeoutEvents.filter((e) => e.side === "own" && e.quarter === quarter).length;
  const opponentTimeoutCount = timeoutEvents.filter((e) => e.side === "opponent" && e.quarter === quarter).length;

  return (
    <>
      <SectionLabel action={<TimeoutButton color="orange" count={ownTimeoutCount} onTap={onOwnTimeout} />}>
        自チームのスタッツ
      </SectionLabel>
      <ChipRow
        entrants={ownEntrants}
        statLines={ownStatLines}
        active={(id) => selected?.side === "own" && selected.id === id}
        showName
        onSelect={(id) => setSelected({ side: "own", id })}
        onOpenMemberChange={onOpenOwnMemberChange}
        onUndo={handleUndo}
        canUndo={!!lastEntry}
      />

      {ownEntrants.length === 0 && opponentEntrants.length === 0 ? (
        <EmptyState>スタメンを登録するか、交代ボタンから選手を選んでください</EmptyState>
      ) : (
        <>
          <Card className="mt-2">
            <div className="grid grid-cols-2 gap-1.5">
              {gridCells.map((cell) => {
                if (cell.type === "ft") {
                  return (
                    <button
                      key="ft"
                      type="button"
                      disabled={!selected}
                      onClick={() => setFtModalOpen(true)}
                      className={`flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 rounded-lg border border-line bg-paper ${
                        selected ? "" : "opacity-45"
                      }`}
                    >
                      <div className="text-[12px] font-bold">FT(フリースロー)</div>
                      <div className="font-mono text-[17px] font-bold">
                        {row ? `${row.ft_made}/${row.ft_att}` : "-"}
                      </div>
                    </button>
                  );
                }
                const { event, label } = cell;
                const count = row ? statEventCount(row, event) : null;
                return (
                  <button
                    key={event}
                    type="button"
                    disabled={!selected}
                    onClick={() => handleTap(event)}
                    className={`flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 rounded-lg border border-line bg-paper ${
                      selected ? "" : "opacity-45"
                    }`}
                  >
                    <div className="text-[12px] font-bold">{label}</div>
                    <div className="font-mono text-[17px] font-bold">{count ?? "-"}</div>
                  </button>
                );
              })}
            </div>
          </Card>
        </>
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
        <SectionLabel
          align="right"
          action={<TimeoutButton color="navy" count={opponentTimeoutCount} onTap={onOpponentTimeout} />}
        >
          相手チームのスタッツ
        </SectionLabel>
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
