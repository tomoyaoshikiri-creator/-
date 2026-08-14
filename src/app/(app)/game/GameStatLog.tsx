"use client";

import { useState } from "react";
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
// タップで展開すると、クォーターの修正・記録の削除ができる。
export function GameStatLog({
  title,
  events,
  onChangeQuarter,
  onDelete,
}: {
  title: string;
  events: StatLogEntry[];
  onChangeQuarter: (id: string, quarter: number) => void;
  onDelete: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  if (events.length === 0) return null;

  function handleDeleteClick(id: string) {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    setDeleteConfirmId(null);
    setExpandedId(null);
    onDelete(id);
  }

  return (
    <div className="mt-4">
      <SectionLabel>{title}</SectionLabel>
      <Card>
        {events.slice(0, 20).map((e) => {
          const pts = statEventPoints(e.event, e.delta);
          const expanded = expandedId === e.id;
          return (
            <div key={e.id} className="border-b border-line last:border-b-0">
              <div
                className="flex items-center justify-between py-0.5 text-[11px] leading-tight cursor-pointer"
                onClick={() => setExpandedId(expanded ? null : e.id)}
              >
                <div>
                  <span className="font-mono text-ink-soft mr-1">{e.quarter}Q</span>
                  <span className="font-bold">{e.entrantLabel}</span>
                  <span className="text-ink-soft ml-1">
                    {statEventLabel(e.event)}
                    {e.delta < 0 ? "(取消)" : ""}
                  </span>
                </div>
                {pts !== 0 && <span className="font-mono font-bold text-orange">{pts > 0 ? `+${pts}` : pts}</span>}
              </div>
              {expanded && (
                <div className="pb-2.5">
                  <div className="text-[10.5px] font-bold text-ink-soft mb-1">クォーターを修正</div>
                  <div className="flex gap-1.5 mb-2">
                    {[1, 2, 3, 4].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => onChangeQuarter(e.id, q)}
                        className={`flex-1 py-1 rounded-[8px] font-bold text-[11.5px] border ${
                          e.quarter === q ? "bg-orange border-orange text-white" : "border-line text-ink-soft bg-white"
                        }`}
                      >
                        {q}Q
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(e.id)}
                    className="w-full text-center py-1.5 rounded-[8px] font-bold text-[11.5px] border bg-white"
                    style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                  >
                    {deleteConfirmId === e.id ? "もう一度タップで削除確定" : "この記録を削除"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
