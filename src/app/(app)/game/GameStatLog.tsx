"use client";

import { Card, SectionLabel } from "@/components/ui/Card";
import { statEventLabel, statEventPoints } from "@/lib/gameStats";
import { playerFullName } from "@/lib/format";
import type { GameStatEvent, Player } from "@/lib/database.types";

// HOOP Jのプレーバイプレーログを再現した、直近の記録一覧(新しい順)。
export function GameStatLog({ events, players }: { events: GameStatEvent[]; players: Player[] }) {
  if (events.length === 0) return null;

  return (
    <div className="mt-4">
      <SectionLabel>記録ログ</SectionLabel>
      <Card>
        {events.slice(0, 20).map((e) => {
          const player = players.find((p) => p.id === e.player_id);
          const pts = statEventPoints(e.event, e.delta);
          return (
            <div
              key={e.id}
              className="flex items-center justify-between py-1.5 border-b border-line last:border-b-0 text-[12.5px]"
            >
              <div>
                <span className="font-mono text-ink-soft mr-1.5">{e.quarter}Q</span>
                <span className="font-bold">
                  {player ? `#${player.number ?? "-"} ${playerFullName(player)}` : "-"}
                </span>
                <span className="text-ink-soft ml-1.5">
                  {statEventLabel(e.event)}
                  {e.delta < 0 ? "(取消)" : ""}
                </span>
              </div>
              {pts !== 0 && <span className="font-mono font-bold text-orange">{pts > 0 ? `+${pts}` : pts}</span>}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
