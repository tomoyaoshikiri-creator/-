"use client";

import { Card, SectionLabel } from "@/components/ui/Card";
import { statEventLabel, statEventPoints, type StatEvent } from "@/lib/gameStats";

export interface StatLogEntry {
  id: string;
  quarter: number;
  entrantLabel: string;
  event: StatEvent;
  delta: number;
}

// HOOP Jのプレーバイプレーログを再現した、直近の記録一覧(新しい順)。
export function GameStatLog({ title, events }: { title: string; events: StatLogEntry[] }) {
  if (events.length === 0) return null;

  return (
    <div className="mt-4">
      <SectionLabel>{title}</SectionLabel>
      <Card>
        {events.slice(0, 20).map((e) => {
          const pts = statEventPoints(e.event, e.delta);
          return (
            <div
              key={e.id}
              className="flex items-center justify-between py-1.5 border-b border-line last:border-b-0 text-[12.5px]"
            >
              <div>
                <span className="font-mono text-ink-soft mr-1.5">{e.quarter}Q</span>
                <span className="font-bold">{e.entrantLabel}</span>
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
