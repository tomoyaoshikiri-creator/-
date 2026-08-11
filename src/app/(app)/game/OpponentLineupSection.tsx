"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { Card, EmptyState } from "@/components/ui/Card";
import { SubmitButton, FieldLabel } from "@/components/ui/SegButton";
import type { GameOpponentPlayer } from "@/lib/database.types";

function OpponentCheckRow({
  opponentPlayer,
  checked,
  dimmed,
  onToggle,
}: {
  opponentPlayer: GameOpponentPlayer;
  checked: boolean;
  dimmed?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-2.5 py-2 px-2 -mx-2 rounded-lg border-b border-line last:border-b-0 text-left ${
        dimmed ? "opacity-40" : ""
      } ${checked ? "bg-orange/10" : ""}`}
    >
      <div className={`font-mono font-bold text-[13.5px] ${checked ? "text-orange" : ""}`}>
        #{opponentPlayer.number}
      </div>
    </button>
  );
}

// クォーターごとの相手チームのスタメン(最大5人)だけを、登録済みの背番号ロースターから選ぶ。
// 自チームのLineupSectionと同じ考え方(途中交代はメンバーチェンジから行う)。
export function OpponentLineupSection({
  opponentPlayers,
  starters,
  recordId,
  saving,
  onSaveStarters,
  onDeleteRecord,
}: {
  opponentPlayers: GameOpponentPlayer[];
  starters: string[];
  recordId: string | null;
  saving: boolean;
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
      <FieldLabel>登録済み相手スタメン</FieldLabel>
      <Card className="cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <div className="text-[13px] font-bold font-mono">
          {starters.length > 0 ? (
            starters
              .map((id) => opponentPlayers.find((p) => p.id === id))
              .filter((p): p is GameOpponentPlayer => Boolean(p))
              .map((p) => <div key={p.id}>#{p.number}</div>)
          ) : (
            <div className="font-sans">未登録</div>
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
        <FieldLabel>相手スターティング(最大5人)</FieldLabel>
        <Card>
          {opponentPlayers.length === 0 ? (
            <EmptyState>まず背番号を登録してください</EmptyState>
          ) : (
            opponentPlayers.map((p) => (
              <OpponentCheckRow
                key={p.id}
                opponentPlayer={p}
                checked={draft.includes(p.id)}
                dimmed={draft.length >= 5 && !draft.includes(p.id)}
                onToggle={() => toggleDraft(p.id)}
              />
            ))
          )}
        </Card>
      </div>

      <SubmitButton onClick={handleSave} disabled={saving || opponentPlayers.length === 0}>
        {saving ? "登録中…" : "相手スターティングを登録する"}
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
