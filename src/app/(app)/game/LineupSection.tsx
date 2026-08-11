"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { Card, EmptyState } from "@/components/ui/Card";
import { NumChip } from "@/components/ui/Pill";
import { SubmitButton, FieldLabel } from "@/components/ui/SegButton";
import { playerFullName } from "@/lib/format";
import type { AttendanceStatus, Player } from "@/lib/database.types";

function PlayerCheckRow({
  player,
  checked,
  disabled,
  absent,
  onToggle,
}: {
  player: Player;
  checked: boolean;
  disabled: boolean;
  absent?: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 py-2 border-b border-line last:border-b-0 ${
        disabled || absent ? "opacity-40" : ""
      }`}
    >
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

// クォーターごとのスタメン・途中出場を登録する。StatPadに表示する「出場中の選手」は
// ここで登録された内容(starters+subs)をそのまま使う。
export function LineupSection({
  matchId,
  teamId,
  quarter,
  players,
  attendanceStatus,
  onChange,
}: {
  matchId: string;
  teamId: string;
  quarter: number;
  players: Player[];
  attendanceStatus: Record<string, AttendanceStatus>;
  onChange: (onCourtIds: string[]) => void;
}) {
  const toast = useToast();
  const [starters, setStarters] = useState<string[]>([]);
  const [subs, setSubs] = useState<string[]>([]);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [memberEditing, setMemberEditing] = useState(false);
  const [memberExpanded, setMemberExpanded] = useState(false);
  const [deleteRecordConfirm, setDeleteRecordConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadRecord = useCallback(async () => {
    setMemberEditing(false);
    setMemberExpanded(false);
    setDeleteRecordConfirm(false);
    if (!matchId) {
      setStarters([]);
      setSubs([]);
      setRecordId(null);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("game_records")
      .select("*")
      .eq("match_id", matchId)
      .eq("quarter", quarter)
      .maybeSingle();
    setStarters(data?.starter_player_ids ?? []);
    setSubs(data?.sub_player_ids ?? []);
    setRecordId(data?.id ?? null);
  }, [matchId, quarter]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  useEffect(() => {
    onChange(Array.from(new Set([...starters, ...subs])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starters, subs]);

  function toggleStarter(id: string) {
    const isActive = starters.includes(id);
    if (!isActive && starters.length >= 5) {
      toast("スターティングは5人までです");
      return;
    }
    setStarters(isActive ? starters.filter((x) => x !== id) : [...starters, id]);
    if (!isActive) setSubs((prev) => prev.filter((x) => x !== id));
  }

  function toggleSub(id: string) {
    if (starters.includes(id)) {
      toast("スターティングの選手は途中出場に選べません");
      return;
    }
    setSubs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit() {
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("game_records")
      .upsert(
        {
          team_id: teamId,
          match_id: matchId,
          quarter,
          starter_player_ids: starters,
          sub_player_ids: subs,
        },
        { onConflict: "match_id,quarter" },
      )
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast(`登録に失敗しました: ${error.message}`);
      return;
    }
    setRecordId(data?.id ?? null);
    setMemberEditing(false);
    toast(`${quarter}Qの出場選手を登録しました`);
  }

  async function handleDeleteRecord() {
    if (!recordId) return;
    if (!deleteRecordConfirm) {
      setDeleteRecordConfirm(true);
      setTimeout(() => setDeleteRecordConfirm(false), 3000);
      return;
    }
    setDeleteRecordConfirm(false);
    const supabase = createClient();
    const { error } = await supabase.from("game_records").delete().eq("id", recordId);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    setStarters([]);
    setSubs([]);
    setRecordId(null);
    setMemberExpanded(false);
    toast(`${quarter}Qの登録を削除しました`);
  }

  return recordId && !memberEditing ? (
    <div className="mt-3">
      <FieldLabel>登録済みメンバー</FieldLabel>
      <Card className="cursor-pointer" onClick={() => setMemberExpanded((v) => !v)}>
        <div className="text-xs font-bold text-ink-soft mb-1">スターティング</div>
        <div className="text-[13px] font-bold mb-2">
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
        <div className="text-xs font-bold text-ink-soft mb-1">途中出場</div>
        <div className="text-[13px] font-bold">
          {subs.length > 0 ? (
            subs
              .map((id) => players.find((p) => p.id === id))
              .filter((p): p is Player => Boolean(p))
              .map((p) => (
                <div key={p.id}>
                  <span className="font-mono text-ink-soft">{p.number ?? "-"}</span> {playerFullName(p)}
                </div>
              ))
          ) : (
            <div>なし</div>
          )}
        </div>
        {memberExpanded && (
          <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setMemberEditing(true)}
              className="flex-1 text-center py-2 rounded-[10px] font-bold text-[12.5px] border border-line text-ink-soft bg-paper"
            >
              編集
            </button>
            <button
              type="button"
              onClick={handleDeleteRecord}
              className="flex-1 text-center py-2 rounded-[10px] font-bold text-[12.5px] border bg-white"
              style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            >
              {deleteRecordConfirm ? "もう一度タップで削除確定" : "削除"}
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
                checked={starters.includes(p.id)}
                disabled={false}
                absent={attendanceStatus[p.id] === "欠席"}
                onToggle={() => toggleStarter(p.id)}
              />
            ))
          )}
        </Card>
      </div>

      <div className="mt-3">
        <FieldLabel>途中出場</FieldLabel>
        <Card>
          {players.length === 0 ? (
            <EmptyState>在籍中の選手がいません</EmptyState>
          ) : (
            players.map((p) => (
              <PlayerCheckRow
                key={p.id}
                player={p}
                checked={subs.includes(p.id)}
                disabled={starters.includes(p.id)}
                absent={attendanceStatus[p.id] === "欠席"}
                onToggle={() => toggleSub(p.id)}
              />
            ))
          )}
        </Card>
      </div>

      <SubmitButton onClick={handleSubmit} disabled={saving || players.length === 0}>
        {saving ? "登録中…" : "このクォーターを登録する"}
      </SubmitButton>
      {memberEditing && (
        <button
          type="button"
          onClick={() => loadRecord()}
          disabled={saving}
          className="w-full mt-2.5 text-center py-2 rounded-[10px] font-bold text-[12.5px] border border-line bg-white text-ink-soft"
        >
          キャンセル
        </button>
      )}
    </>
  );
}
