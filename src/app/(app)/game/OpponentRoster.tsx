"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { FieldLabel, inputClass } from "@/components/ui/SegButton";
import type { GameOpponentPlayer } from "@/lib/database.types";

// 対戦相手はClubLinkに選手登録がないため、背番号だけの簡易ロースターを試合ごとに管理する。
export function OpponentRoster({
  matchId,
  teamId,
  opponentPlayers,
  onChange,
}: {
  matchId: string;
  teamId: string;
  opponentPlayers: GameOpponentPlayer[];
  onChange: (players: GameOpponentPlayer[]) => void;
}) {
  const toast = useToast();
  const [newNumber, setNewNumber] = useState("");
  const [adding, setAdding] = useState(false);
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleAdd() {
    const number = newNumber.trim();
    if (!number) return;
    if (opponentPlayers.some((p) => p.number === number)) {
      toast("すでに登録されている背番号です");
      return;
    }
    setAdding(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("game_opponent_players")
      .insert({ team_id: teamId, match_id: matchId, number })
      .select()
      .single();
    setAdding(false);
    if (error) {
      toast(`追加に失敗しました: ${error.message}`);
      return;
    }
    if (data) {
      setNewNumber("");
      onChange([...opponentPlayers, data]);
    }
  }

  // 4〜18番は日本のミニバスケットボールでよく使われる背番号の範囲。
  // 手動入力とは別に、まとめて登録できるテンプレートを用意する。
  async function handleAddTemplate() {
    const existing = new Set(opponentPlayers.map((p) => p.number));
    const numbers = Array.from({ length: 15 }, (_, i) => String(i + 4)).filter((n) => !existing.has(n));
    if (numbers.length === 0) {
      toast("4〜18番はすべて登録済みです");
      return;
    }
    setAddingTemplate(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("game_opponent_players")
      .insert(numbers.map((number) => ({ team_id: teamId, match_id: matchId, number })))
      .select();
    setAddingTemplate(false);
    if (error) {
      toast(`一括登録に失敗しました: ${error.message}`);
      return;
    }
    if (data) {
      onChange([...opponentPlayers, ...data]);
      toast(`${data.length}件登録しました`);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    const supabase = createClient();
    const { error } = await supabase.from("game_opponent_players").delete().eq("id", id);
    setRemovingId(null);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    onChange(opponentPlayers.filter((p) => p.id !== id));
  }

  const sortedPlayers = [...opponentPlayers].sort(
    (a, b) => Number(a.number) - Number(b.number) || a.number.localeCompare(b.number),
  );

  return (
    <div className="mt-3">
      <FieldLabel>相手選手の背番号</FieldLabel>
      <Card>
        <div className="flex gap-1.5">
          <input
            className={inputClass("flex-1")}
            value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="例:6"
            inputMode="numeric"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !newNumber.trim()}
            className="flex-none px-4 rounded-[10px] font-bold text-[12.5px] text-white bg-orange disabled:opacity-50"
          >
            追加
          </button>
        </div>
        <button
          type="button"
          onClick={handleAddTemplate}
          disabled={addingTemplate}
          className="w-full mt-1.5 py-1.5 rounded-[10px] font-bold text-[12px] border border-line text-ink-soft bg-paper disabled:opacity-50"
        >
          {addingTemplate ? "登録中…" : "4〜18番を一括登録"}
        </button>
        {opponentPlayers.length === 0 ? (
          <div className="text-xs text-ink-soft mt-2.5">まだ背番号が登録されていません</div>
        ) : (
          <div className="flex gap-1.5 flex-wrap mt-2.5">
            {sortedPlayers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleRemove(p.id)}
                disabled={removingId === p.id}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-line bg-paper font-mono text-[12.5px] font-bold"
              >
                #{p.number} <span className="text-ink-soft">×</span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
