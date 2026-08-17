"use client";

import { useState } from "react";
import { useSession } from "@/lib/session-context";
import { usesThreePointScoring } from "@/lib/sport";
import { FreeThrowModal } from "./FreeThrowModal";
import { buildGridCells, type StatEntrant } from "./StatPad";
import {
  STAT_BUTTONS,
  statEventCount,
  statEventLabel,
  statEventPoints,
  type StatEvent,
  type StatTotals,
} from "@/lib/gameStats";
import { playerFullName, formatSlashDateLabel } from "@/lib/format";
import type { GameMatch, GameOpponentPlayer, GameOpponentStatEvent, GameStatEvent, Player, Schedule } from "@/lib/database.types";

type Side = "own" | "opponent";

const CIRCLED = ["①", "②", "③", "④"];

function quarterPoints(events: { event: StatEvent; delta: number; quarter: number }[], q: number): number {
  return events.filter((e) => e.quarter === q).reduce((sum, e) => sum + statEventPoints(e.event, e.delta), 0);
}

function SquareChip({
  entrant,
  pts,
  active,
  activeColor,
  showName,
  onSelect,
}: {
  entrant: StatEntrant;
  pts: number;
  active: boolean;
  activeColor: "orange" | "navy";
  showName: boolean;
  onSelect: () => void;
}) {
  const activeClass = activeColor === "navy" ? "bg-navy border-navy text-white" : "bg-orange border-orange text-white";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex-none w-[68px] h-[78px] flex flex-col items-center justify-center rounded-xl border font-bold ${
        active ? activeClass : "border-line bg-white text-ink"
      }`}
    >
      {showName && entrant.name && (
        <span
          className={`w-full px-1 text-[8.5px] font-bold truncate text-center leading-none ${
            active ? "text-white/85" : "text-ink-soft"
          }`}
        >
          {entrant.name}
        </span>
      )}
      <span className="font-mono text-[17px] leading-none mt-[2px]">{entrant.number ?? "-"}</span>
      <span className={`font-mono text-[10px] mt-[2px] leading-none ${active ? "text-white/85" : "text-ink-soft"}`}>
        {pts}pts
      </span>
    </button>
  );
}

interface LogRowData {
  id: string;
  quarter: number;
  who: string;
  event: StatEvent;
  pt: number;
  side: Side;
  playerId: string;
}

export function GameStatsLandscape({
  quarter,
  onQuarterChange,
  match,
  schedule,
  ownScore,
  oppScore,
  ownStatEvents,
  opponentStatEvents,
  ownEntrants,
  ownStatLines,
  opponentEntrants,
  opponentStatLines,
  onOwnTap,
  onOpponentTap,
  onOwnFreeThrowTrip,
  onOpponentFreeThrowTrip,
  onOpenOwnMemberChange,
  onOpenOpponentMemberChange,
  players,
  opponentPlayers,
  onDeleteStatEvent,
  onDeleteOpponentStatEvent,
  resetConfirm,
  resetting,
  onResetAll,
}: {
  quarter: number;
  onQuarterChange: (q: number) => void;
  match: GameMatch;
  schedule: Schedule | null;
  ownScore: number;
  oppScore: number;
  ownStatEvents: GameStatEvent[];
  opponentStatEvents: GameOpponentStatEvent[];
  ownEntrants: StatEntrant[];
  ownStatLines: Record<string, StatTotals>;
  opponentEntrants: StatEntrant[];
  opponentStatLines: Record<string, StatTotals>;
  onOwnTap: (entrantId: string, event: StatEvent) => void;
  onOpponentTap: (entrantId: string, event: StatEvent) => void;
  onOwnFreeThrowTrip: (entrantId: string, makes: number, attempts: number) => void;
  onOpponentFreeThrowTrip: (entrantId: string, makes: number, attempts: number) => void;
  onOpenOwnMemberChange: () => void;
  onOpenOpponentMemberChange: () => void;
  players: Player[];
  opponentPlayers: GameOpponentPlayer[];
  onDeleteStatEvent: (eventId: string) => Promise<void>;
  onDeleteOpponentStatEvent: (eventId: string) => Promise<void>;
  resetConfirm: boolean;
  resetting: boolean;
  onResetAll: () => void;
}) {
  const { sport } = useSession();
  const gridCells = buildGridCells(usesThreePointScoring(sport));
  const [selected, setSelected] = useState<{ side: Side; id: string } | null>(null);
  const [ftModalOpen, setFtModalOpen] = useState(false);
  const [possession, setPossession] = useState<"own" | "opponent" | null>(null);
  const [correcting, setCorrecting] = useState<LogRowData | null>(null);

  const selectedEntrant = selected
    ? (selected.side === "own" ? ownEntrants : opponentEntrants).find((e) => e.id === selected.id)
    : undefined;
  const selectedRow = selectedEntrant
    ? (selected!.side === "own" ? ownStatLines : opponentStatLines)[selectedEntrant.id]
    : undefined;

  function handleTap(event: StatEvent) {
    if (!selected || !selectedEntrant) return;
    if (selected.side === "own") onOwnTap(selectedEntrant.id, event);
    else onOpponentTap(selectedEntrant.id, event);
    setSelected(null);
  }

  function handleSaveFreeThrows(results: boolean[]) {
    if (!selected || !selectedEntrant) return;
    const makes = results.filter(Boolean).length;
    if (selected.side === "own") onOwnFreeThrowTrip(selectedEntrant.id, makes, results.length);
    else onOpponentFreeThrowTrip(selectedEntrant.id, makes, results.length);
    setFtModalOpen(false);
    setSelected(null);
  }

  // 選手選択の有無にかかわらず、自チーム・相手チームを通じて直前に記録された1件を取り消す。
  const allEvents: LogRowData[] = [
    ...ownStatEvents.map((e) => {
      const p = players.find((pl) => pl.id === e.player_id);
      return {
        id: e.id,
        quarter: e.quarter,
        who: p ? `#${p.number ?? "-"} ${playerFullName(p)}` : "-",
        event: e.event,
        pt: statEventPoints(e.event, e.delta),
        side: "own" as const,
        playerId: e.player_id,
      };
    }),
    ...opponentStatEvents.map((e) => {
      const p = opponentPlayers.find((op) => op.id === e.opponent_player_id);
      return {
        id: e.id,
        quarter: e.quarter,
        who: p ? `#${p.number}` : "-",
        event: e.event,
        pt: statEventPoints(e.event, e.delta),
        side: "opponent" as const,
        playerId: e.opponent_player_id,
      };
    }),
  ];
  const currentQuarterEvents = allEvents
    .filter((e) => e.quarter === quarter)
    .sort((a, b) => {
      const aSrc = a.side === "own" ? ownStatEvents : opponentStatEvents;
      const bSrc = b.side === "own" ? ownStatEvents : opponentStatEvents;
      const aCreated = aSrc.find((x) => x.id === a.id)?.created_at ?? "";
      const bCreated = bSrc.find((x) => x.id === b.id)?.created_at ?? "";
      return bCreated.localeCompare(aCreated);
    });
  const lastEntry = currentQuarterEvents[0];

  async function handleUndo() {
    if (!lastEntry) return;
    if (lastEntry.side === "own") await onDeleteStatEvent(lastEntry.id);
    else await onDeleteOpponentStatEvent(lastEntry.id);
  }

  async function reassignEntry(newSide: Side, newPlayerId: string, newEvent: StatEvent) {
    if (!correcting) return;
    if (correcting.side === newSide && correcting.playerId === newPlayerId && correcting.event === newEvent) return;
    if (correcting.side === "own") await onDeleteStatEvent(correcting.id);
    else await onDeleteOpponentStatEvent(correcting.id);
    if (newSide === "own") onOwnTap(newPlayerId, newEvent);
    else onOpponentTap(newPlayerId, newEvent);
    setCorrecting(null);
  }

  async function deleteCorrecting() {
    if (!correcting) return;
    if (correcting.side === "own") await onDeleteStatEvent(correcting.id);
    else await onDeleteOpponentStatEvent(correcting.id);
    setCorrecting(null);
  }

  const ownName = schedule?.title ?? "自チーム";
  const oppName = match.opponent || "相手";

  return (
    <div className="relative">
      <div className="relative flex items-center justify-center py-2">
        <div className="absolute left-0 top-1/2 -translate-y-1/2">
          <div className="font-mono text-[10px] font-bold text-ink-soft opacity-65">
            {schedule ? formatSlashDateLabel(schedule.date) : ""}
          </div>
          <div className="text-[11px] font-bold text-ink-soft">
            第{match.game_number}試合{match.opponent ? ` vs ${match.opponent}` : ""}
          </div>
        </div>

        <div className="flex items-center gap-4.5">
          <div className="w-[210px] flex items-center justify-end gap-2.5">
            <span className="text-[16.5px] font-bold text-ink-soft truncate max-w-[130px]">{ownName}</span>
            <span className="font-mono text-[39px] font-bold leading-none text-orange">{ownScore}</span>
          </div>
          <div className="flex flex-col gap-0.5 font-mono text-[11px] font-bold">
            {Array.from({ length: quarter }, (_, i) => i + 1).map((q) => (
              <div key={q} className="flex items-center justify-center gap-2">
                <span className="w-4 text-center">{quarterPoints(ownStatEvents, q)}</span>
                <span className="text-ink-soft opacity-70">{CIRCLED[q - 1] ?? q}</span>
                <span className="w-4 text-center">{quarterPoints(opponentStatEvents, q)}</span>
              </div>
            ))}
          </div>
          <div className="w-[210px] flex items-center gap-2.5">
            <span className="font-mono text-[39px] font-bold leading-none">{oppScore}</span>
            <span className="text-[16.5px] font-bold text-ink-soft truncate max-w-[130px]">{oppName}</span>
          </div>
        </div>

        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onQuarterChange(q)}
                className={`px-2.5 py-1.5 rounded-lg text-[11.5px] font-bold border ${
                  quarter === q ? "bg-orange border-orange text-white" : "border-line bg-white text-ink-soft"
                }`}
              >
                {q}Q
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative flex items-center justify-center gap-2.5 py-1.5 border-t border-b border-line">
        <button
          type="button"
          onClick={() => setPossession("own")}
          aria-label="自チームにポゼッション"
          className={`text-[26px] leading-none -mt-2.5 scale-x-[-1] ${possession === "own" ? "text-danger" : "text-ink-soft"}`}
        >
          ➡︎
        </button>
        <button
          type="button"
          onClick={() => setPossession("opponent")}
          aria-label="相手チームにポゼッション"
          className={`text-[26px] leading-none -mt-2.5 ${possession === "opponent" ? "text-danger" : "text-ink-soft"}`}
        >
          ➡︎
        </button>
        <button
          type="button"
          onClick={onResetAll}
          disabled={resetting}
          className={`absolute left-4.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-danger text-danger bg-white ${
            resetConfirm ? "" : "opacity-50"
          }`}
        >
          {resetting ? "リセット中…" : resetConfirm ? "もう一度タップでリセット確定" : "オールリセット"}
        </button>
      </div>

      <div
        className="grid gap-2.5 pt-3 pb-4"
        style={{ gridTemplateColumns: "minmax(150px,190px) 112fr 540fr 112fr minmax(150px,190px)" }}
      >
        <LogColumn title="自チームの記録ログ" entries={currentQuarterEvents.filter((e) => e.side === "own")} onOpen={setCorrecting} align="left" />

        <div className="flex flex-col items-center min-h-0">
          <div className="font-mono text-[10px] font-bold tracking-widest uppercase text-ink-soft mb-1.5">自チーム</div>
          <div className="flex flex-col gap-1.5 items-center">
            {ownEntrants.map((e) => (
              <SquareChip
                key={e.id}
                entrant={e}
                pts={ownStatLines[e.id]?.pts ?? 0}
                active={selected?.side === "own" && selected.id === e.id}
                activeColor="orange"
                showName
                onSelect={() => setSelected({ side: "own", id: e.id })}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onOpenOwnMemberChange}
            className="mt-2 w-[68px] py-1.5 rounded-[10px] border border-dashed border-line text-ink-soft font-bold text-[10px]"
          >
            ⇄ 交代
          </button>
        </div>

        <div className="flex flex-col items-center min-h-0">
          <button
            type="button"
            disabled={!lastEntry}
            onClick={handleUndo}
            className={`w-full mb-2 py-1.5 rounded-[10px] border border-dashed border-danger text-danger font-bold text-[12px] ${
              lastEntry ? "" : "opacity-40"
            }`}
          >
            取消
          </button>
          <div
            className="grid grid-cols-2 gap-1.5 w-full"
            style={{ gridAutoRows: "78px" }}
          >
            {gridCells.map((cell) => {
              if (cell.type === "ft") {
                return (
                  <button
                    key="ft"
                    type="button"
                    disabled={!selected}
                    onClick={() => setFtModalOpen(true)}
                    className={`rounded-xl border border-line bg-paper flex flex-col items-center justify-center gap-0.5 ${
                      selected ? "" : "opacity-45"
                    }`}
                  >
                    <span className="text-[13px] font-bold">FT(フリースロー)</span>
                    <span className="font-mono text-[20px] font-bold">
                      {selectedRow ? `${selectedRow.ft_made}/${selectedRow.ft_att}` : "-"}
                    </span>
                  </button>
                );
              }
              const { event, label } = cell;
              const count = selectedRow ? statEventCount(selectedRow, event) : null;
              return (
                <button
                  key={event}
                  type="button"
                  disabled={!selected}
                  onClick={() => handleTap(event)}
                  className={`rounded-xl border border-line bg-paper flex flex-col items-center justify-center gap-0.5 ${
                    selected ? "" : "opacity-45"
                  }`}
                >
                  <span className="text-[13px] font-bold">{label}</span>
                  <span className="font-mono text-[20px] font-bold">{count ?? "-"}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col items-center min-h-0">
          <div className="font-mono text-[10px] font-bold tracking-widest uppercase text-ink-soft mb-1.5">相手チーム</div>
          <div className="flex flex-col gap-1.5 items-center">
            {opponentEntrants.map((e) => (
              <SquareChip
                key={e.id}
                entrant={e}
                pts={opponentStatLines[e.id]?.pts ?? 0}
                active={selected?.side === "opponent" && selected.id === e.id}
                activeColor="navy"
                showName={false}
                onSelect={() => setSelected({ side: "opponent", id: e.id })}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onOpenOpponentMemberChange}
            className="mt-2 w-[68px] py-1.5 rounded-[10px] border border-dashed border-line text-ink-soft font-bold text-[10px]"
          >
            ⇄ 交代
          </button>
        </div>

        <LogColumn
          title="相手チームの記録ログ"
          entries={currentQuarterEvents.filter((e) => e.side === "opponent")}
          onOpen={setCorrecting}
          align="right"
        />
      </div>

      {selectedEntrant && (
        <FreeThrowModal
          open={ftModalOpen}
          onClose={() => setFtModalOpen(false)}
          entrantLabel={`#${selectedEntrant.number ?? "-"}${selectedEntrant.name ? ` ${selectedEntrant.name}` : ""}`}
          onSave={handleSaveFreeThrows}
        />
      )}

      {correcting && (
        <FixEntryOverlay
          entry={correcting}
          players={players}
          opponentPlayers={opponentPlayers}
          onClose={() => setCorrecting(null)}
          onReassignPlayer={(side, playerId) => reassignEntry(side, playerId, correcting.event)}
          onReassignStat={(event) => reassignEntry(correcting.side, correcting.playerId, event)}
          onDelete={deleteCorrecting}
        />
      )}
    </div>
  );
}

function LogColumn({
  title,
  entries,
  onOpen,
  align,
}: {
  title: string;
  entries: LogRowData[];
  onOpen: (entry: LogRowData) => void;
  align: "left" | "right";
}) {
  return (
    <div className="max-w-[178px] justify-self-center flex flex-col min-h-0">
      <div className={`font-mono text-[10px] font-bold tracking-widest uppercase text-ink-soft mb-1.5 ${align === "right" ? "text-right" : ""}`}>
        {title}
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col gap-0.5">
        {entries.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onOpen(e)}
            className="text-left text-[12px] leading-[1.4] py-1 px-1.5 rounded-md border-b border-line"
          >
            {e.pt !== 0 && (
              <span className={`float-right font-mono font-bold ${e.side === "own" ? "text-orange" : "text-navy"}`}>
                {e.pt > 0 ? `+${e.pt}` : e.pt}
              </span>
            )}
            <span className="font-mono text-ink-soft mr-1">{e.quarter}Q</span>
            <span className="font-bold">{e.who}</span>
            <span className="text-ink-soft ml-1">{statEventLabel(e.event)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FixEntryOverlay({
  entry,
  players,
  opponentPlayers,
  onClose,
  onReassignPlayer,
  onReassignStat,
  onDelete,
}: {
  entry: LogRowData;
  players: Player[];
  opponentPlayers: GameOpponentPlayer[];
  onClose: () => void;
  onReassignPlayer: (side: Side, playerId: string) => void;
  onReassignStat: (event: StatEvent) => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="absolute inset-0 bg-navy/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[min(92%,980px)] max-h-[88%] bg-white rounded-[18px] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-line">
          <button type="button" onClick={onClose} className="text-orange font-bold text-[13px]">
            キャンセル
          </button>
          <div className="text-[13.5px] font-extrabold">プレーヤーまたはプレーを選択してください</div>
          <div className="w-11" />
        </div>
        <div className="flex-1 overflow-y-auto grid grid-cols-[1fr_1.5fr_1fr] gap-3.5 p-4">
          <div>
            <div className="font-mono text-[10.5px] font-bold tracking-widest uppercase text-ink-soft mb-2">自チーム</div>
            <div className="flex flex-col gap-1">
              {players.map((p) => {
                const checked = entry.side === "own" && entry.playerId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onReassignPlayer("own", p.id)}
                    className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-[10px] border border-line bg-paper text-[13px] font-bold text-ink"
                  >
                    <span>
                      #{p.number ?? "-"} {playerFullName(p)}
                    </span>
                    <span className={`font-extrabold text-orange ${checked ? "" : "invisible"}`}>✓</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="font-mono text-[10.5px] font-bold tracking-widest uppercase text-ink-soft mb-2">プレー</div>
            <div className="grid grid-cols-2 gap-1.5">
              {STAT_BUTTONS.map((b) => {
                const checked = entry.event === b.event;
                return (
                  <button
                    key={b.event}
                    type="button"
                    onClick={() => onReassignStat(b.event)}
                    className={`flex items-center justify-between gap-1.5 px-3 py-2.5 rounded-[10px] border text-[13px] font-bold text-ink ${
                      checked ? "border-orange bg-orange/10" : "border-line bg-paper"
                    }`}
                  >
                    <span>{b.label}</span>
                    <span className={`font-extrabold text-orange ${checked ? "" : "invisible"}`}>✓</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="font-mono text-[10.5px] font-bold tracking-widest uppercase text-ink-soft mb-2 text-right">
              相手チーム
            </div>
            <div className="flex flex-col gap-1">
              {opponentPlayers.map((p) => {
                const checked = entry.side === "opponent" && entry.playerId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onReassignPlayer("opponent", p.id)}
                    className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-[10px] border border-line bg-paper text-[13px] font-bold text-ink"
                  >
                    <span>#{p.number}</span>
                    <span className={`font-extrabold text-navy ${checked ? "" : "invisible"}`}>✓</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex-none px-4 py-3 border-t border-line">
          <button
            type="button"
            onClick={onDelete}
            className="w-full py-2 rounded-[10px] border border-dashed border-danger text-danger font-bold text-[12.5px] bg-white"
          >
            この記録を削除
          </button>
        </div>
      </div>
    </div>
  );
}
