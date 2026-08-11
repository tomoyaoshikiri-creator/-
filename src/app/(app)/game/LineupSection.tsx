"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { Card, EmptyState } from "@/components/ui/Card";
import { NumChip } from "@/components/ui/Pill";
import { SubmitButton, FieldLabel } from "@/components/ui/SegButton";
import { playerFullName } from "@/lib/format";
import type { AttendanceStatus, Player } from "@/lib/database.types";

function PlayerCheckRow({
  player,
  checked,
  absent,
  onToggle,
}: {
  player: Player;
  checked: boolean;
  absent?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`flex items-center gap-2.5 py-2 border-b border-line last:border-b-0 ${absent ? "opacity-40" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-[22px] h-[22px] rounded-md border flex items-center justify-center flex-shrink-0 font-bold text-[13px] ${
          checked ? "bg-orange border-orange text-white" : "border-line"
        }`}
      >
        {checked ? "✓" : ""}
      </button>
      <NumChip num={player.number ?? "-"} />
      <div className="font-bold text-[13.5px]">{playerFullName(player)}</div>
      {absent && <span className="text-[10px] font-bold" style={{ color: "var(--danger)" }}>欠席</span>}
    </div>
  );
}

// クォーターごとのスタメン(最大5人)だけを登録する。途中交代はここでは扱わず、
// スタッツ入力画面の「メンバーチェンジ」から行う(試合中に発生するため)。
export function LineupSection({
  starters,
  recordId,
  saving,
  players,
  attendanceStatus,
  onSaveStarters,
  onDeleteRecord,
}: {
  starters: string[];
  recordId: string | null;
  saving: boolean;
  players: Player[];
  attendanceStatus: Record<string, AttendanceStatus>;
  onSaveStarters: (starters: string[]) => void;
  onDeleteRecord: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<string[]>(starters);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(starters);
  }, [starters, editing]);

  function toggleDraft(id: string) {
    const isActive = draft.includes(id);
    if (!isActive && draft.length >= 5) {
      toast("スターティングは5人までです");
      return;
    }
    setDraft(isActive ? draft.filter((x) => x !== id) : [...draft, id]);
  }

  function handleSave() {
    onSaveStarters(draft);
    setEditing(false);
  }

  function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    setDeleteConfirm(false);
    setExpanded(false);
    onDeleteRecord();
  }

  return recordId && !editing ? (
    <div className="mt-3">
      <FieldLabel>登録済みスタメン</FieldLabel>
      <Card className="cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <div className="text-[13px] font-bold">
          {starters.length > 0 ? (
            starters
              .map((id) => players.find((p) => p.id === id))
              .filter((p): p is Player => Boolean(p))
              .map((p) => (
                <div key={p.id}>
                  <span className="font-mono text-ink-soft">{p.number ?? "-"}</span> {playerFullName(p)}
                </div>
              ))
          ) : (
            <div>未登録</div>
          )}
        </div>
        {expanded && (
          <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex-1 text-center py-2 rounded-[10px] font-bold text-[12.5px] border border-line text-ink-soft bg-paper"
            >
              編集
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex-1 text-center py-2 rounded-[10px] font-bold text-[12.5px] border bg-white"
              style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            >
              {deleteConfirm ? "もう一度タップで削除確定" : "削除"}
            </button>
          </div>
        )}
      </Card>
    </div>
  ) : (
    <>
      <div className="mt-3">
        <FieldLabel>スターティング(最大5人)</FieldLabel>
        <Card>
          {players.length === 0 ? (
            <EmptyState>在籍中の選手がいません</EmptyState>
          ) : (
            players.map((p) => (
              <PlayerCheckRow
                key={p.id}
                player={p}
                checked={draft.includes(p.id)}
                absent={attendanceStatus[p.id] === "欠席"}
                onToggle={() => toggleDraft(p.id)}
              />
            ))
          )}
        </Card>
      </div>

      <SubmitButton onClick={handleSave} disabled={saving || players.length === 0}>
        {saving ? "登録中…" : "スターティングを登録する"}
      </SubmitButton>
      {editing && (
        <button
          type="button"
          onClick={() => {
            setDraft(starters);
            setEditing(false);
          }}
          disabled={saving}
          className="w-full mt-2.5 text-center py-2 rounded-[10px] font-bold text-[12.5px] border border-line bg-white text-ink-soft"
        >
          キャンセル
        </button>
      )}
    </>
  );
}
