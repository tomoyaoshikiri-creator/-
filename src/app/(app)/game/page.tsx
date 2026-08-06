"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { CurrentUserBadge } from "@/components/CurrentUserBadge";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { NumChip } from "@/components/ui/Pill";
import { SegButton, SubmitButton, FieldLabel, inputClass } from "@/components/ui/SegButton";
import { canAccessTab } from "@/lib/permissions";
import { playerFullName, scheduleMeta, sortPlayers } from "@/lib/format";
import type { Player, Schedule } from "@/lib/database.types";

function PlayerCheckRow({
  player,
  checked,
  disabled,
  onToggle,
}: {
  player: Player;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`flex items-center gap-2.5 py-2 border-b border-line last:border-b-0 ${disabled ? "opacity-40" : ""}`}>
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
    </div>
  );
}

export default function GamePage() {
  const router = useRouter();
  const { teamId, role } = useSession();
  const toast = useToast();
  const [games, setGames] = useState<Schedule[]>([]);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [quarter, setQuarter] = useState(1);
  const [players, setPlayers] = useState<Player[]>([]);
  const [starters, setStarters] = useState<string[]>([]);
  const [subs, setSubs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: sch }, { data: p }] = await Promise.all([
        supabase.from("schedules").select("*").eq("type", "game").order("date", { ascending: false }),
        supabase.from("players").select("*"),
      ]);
      setGames(sch ?? []);
      setPlayers(sortPlayers((p ?? []).filter((x) => x.status === "在籍")));
      setSelectedGameId((prev) => prev || sch?.[0]?.id || "");
      setLoading(false);
    })();
  }, []);

  const loadRecord = useCallback(async (gameId: string, q: number) => {
    if (!gameId) {
      setStarters([]);
      setSubs([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("game_records")
      .select("*")
      .eq("schedule_id", gameId)
      .eq("quarter", q)
      .maybeSingle();
    setStarters(data?.starter_player_ids ?? []);
    setSubs(data?.sub_player_ids ?? []);
  }, []);

  useEffect(() => {
    loadRecord(selectedGameId, quarter);
  }, [selectedGameId, quarter, loadRecord]);

  useEffect(() => {
    if (!canAccessTab(role, "game")) router.replace("/schedule");
  }, [role, router]);

  function toggleStarter(id: string) {
    const isActive = starters.includes(id);
    if (!isActive && starters.length >= 5) {
      toast("スタメンは5人までです");
      return;
    }
    setStarters(isActive ? starters.filter((x) => x !== id) : [...starters, id]);
    if (!isActive) setSubs((prev) => prev.filter((x) => x !== id));
  }

  function toggleSub(id: string) {
    if (starters.includes(id)) {
      toast("スタメンの選手は途中出場に選べません");
      return;
    }
    setSubs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit() {
    if (!selectedGameId) {
      toast("試合を選択してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("game_records").upsert(
      {
        team_id: teamId,
        schedule_id: selectedGameId,
        quarter,
        starter_player_ids: starters,
        sub_player_ids: subs,
      },
      { onConflict: "schedule_id,quarter" },
    );
    setSaving(false);
    if (error) {
      toast(`登録に失敗しました: ${error.message}`);
      return;
    }
    toast(`${quarter}Qの出場選手を登録しました`);
  }

  const selectedGame = games.find((g) => g.id === selectedGameId);

  return (
    <PageShell header={<AppHeader title="試合記録" rightSlot={<CurrentUserBadge />} />}>
      <SectionLabel>対象の試合を選ぶ</SectionLabel>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : games.length === 0 ? (
        <EmptyState>試合の予定がありません</EmptyState>
      ) : (
        <>
          <select className={inputClass()} value={selectedGameId} onChange={(e) => setSelectedGameId(e.target.value)}>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title} ({scheduleMeta(g)})
              </option>
            ))}
          </select>

          <div className="mt-3">
            <FieldLabel>クォーター</FieldLabel>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map((q) => (
                <SegButton key={q} active={quarter === q} onClick={() => setQuarter(q)}>
                  {q}Q
                </SegButton>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <FieldLabel>スタメン(最大5人)</FieldLabel>
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
                    onToggle={() => toggleSub(p.id)}
                  />
                ))
              )}
            </Card>
          </div>

          <SubmitButton onClick={handleSubmit} disabled={saving || !selectedGame}>
            {saving ? "登録中…" : "このクォーターを登録する"}
          </SubmitButton>
        </>
      )}
    </PageShell>
  );
}
