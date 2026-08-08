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
import { formatDateLabel, playerFullName, sortPlayers, todayDateStr } from "@/lib/format";
import type { AttendanceStatus, GameMatch, Player, Schedule } from "@/lib/database.types";

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

export default function GamePage() {
  const router = useRouter();
  const { teamId, role } = useSession();
  const toast = useToast();
  const [games, setGames] = useState<Schedule[]>([]);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [matches, setMatches] = useState<GameMatch[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [addingMatch, setAddingMatch] = useState(false);
  const [opponent, setOpponent] = useState("");
  const [quarter, setQuarter] = useState(1);
  const [players, setPlayers] = useState<Player[]>([]);
  const [starters, setStarters] = useState<string[]>([]);
  const [subs, setSubs] = useState<string[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: sch }, { data: p }] = await Promise.all([
        supabase.from("schedules").select("*").eq("type", "game").order("date", { ascending: true }),
        supabase.from("players").select("*"),
      ]);
      setGames(sch ?? []);
      setPlayers(sortPlayers((p ?? []).filter((x) => x.status === "在籍")));
      const today = todayDateStr();
      const defaultId = sch?.find((g) => g.date >= today)?.id ?? sch?.[sch.length - 1]?.id ?? "";
      setSelectedGameId((prev) => prev || defaultId);
      setLoading(false);
    })();
  }, []);

  const loadMatches = useCallback(
    async (gameId: string) => {
      if (!gameId) {
        setMatches([]);
        setSelectedMatchId("");
        return;
      }
      setMatchesLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("game_matches")
        .select("*")
        .eq("schedule_id", gameId)
        .order("game_number", { ascending: true });
      let list = data ?? [];
      if (list.length === 0) {
        const { data: created } = await supabase
          .from("game_matches")
          .insert({ team_id: teamId, schedule_id: gameId, game_number: 1 })
          .select()
          .single();
        if (created) list = [created];
      }
      setMatches(list);
      setSelectedMatchId((prev) => (list.some((m) => m.id === prev) ? prev : (list[0]?.id ?? "")));
      setMatchesLoading(false);
    },
    [teamId],
  );

  useEffect(() => {
    loadMatches(selectedGameId);
  }, [selectedGameId, loadMatches]);

  useEffect(() => {
    (async () => {
      if (!selectedGameId) {
        setAttendanceStatus({});
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("attendances")
        .select("player_id, status")
        .eq("schedule_id", selectedGameId)
        .not("player_id", "is", null);
      const map: Record<string, AttendanceStatus> = {};
      (data ?? []).forEach((a) => {
        if (a.player_id) map[a.player_id] = a.status;
      });
      setAttendanceStatus(map);
    })();
  }, [selectedGameId]);

  useEffect(() => {
    const m = matches.find((x) => x.id === selectedMatchId);
    setOpponent(m?.opponent ?? "");
  }, [selectedMatchId, matches]);

  const loadRecord = useCallback(async (matchId: string, q: number) => {
    if (!matchId) {
      setStarters([]);
      setSubs([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("game_records")
      .select("*")
      .eq("match_id", matchId)
      .eq("quarter", q)
      .maybeSingle();
    setStarters(data?.starter_player_ids ?? []);
    setSubs(data?.sub_player_ids ?? []);
  }, []);

  useEffect(() => {
    loadRecord(selectedMatchId, quarter);
  }, [selectedMatchId, quarter, loadRecord]);

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

  async function handleAddMatch() {
    if (!selectedGameId) return;
    setAddingMatch(true);
    const supabase = createClient();
    const nextNumber = (matches[matches.length - 1]?.game_number ?? 0) + 1;
    const { data, error } = await supabase
      .from("game_matches")
      .insert({ team_id: teamId, schedule_id: selectedGameId, game_number: nextNumber })
      .select()
      .single();
    setAddingMatch(false);
    if (error) {
      toast(`追加に失敗しました: ${error.message}`);
      return;
    }
    if (data) {
      setMatches((prev) => [...prev, data]);
      setSelectedMatchId(data.id);
    }
  }

  async function handleSubmit() {
    if (!selectedMatchId) {
      toast("試合を選択してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: opponentError } = await supabase
      .from("game_matches")
      .update({ opponent: opponent.trim() || null })
      .eq("id", selectedMatchId);
    if (opponentError) {
      setSaving(false);
      toast(`保存に失敗しました: ${opponentError.message}`);
      return;
    }
    const { error } = await supabase.from("game_records").upsert(
      {
        team_id: teamId,
        match_id: selectedMatchId,
        quarter,
        starter_player_ids: starters,
        sub_player_ids: subs,
      },
      { onConflict: "match_id,quarter" },
    );
    setSaving(false);
    if (error) {
      toast(`登録に失敗しました: ${error.message}`);
      return;
    }
    setMatches((prev) =>
      prev.map((m) => (m.id === selectedMatchId ? { ...m, opponent: opponent.trim() || null } : m)),
    );
    toast(`${quarter}Qの出場選手を登録しました`);
  }

  const selectedMatch = matches.find((m) => m.id === selectedMatchId);

  return (
    <PageShell header={<AppHeader title="試合記録" rightSlot={<CurrentUserBadge />} />}>
      <SectionLabel>対象の日付を選ぶ</SectionLabel>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : games.length === 0 ? (
        <EmptyState>試合の予定がありません</EmptyState>
      ) : (
        <>
          <select className={inputClass()} value={selectedGameId} onChange={(e) => setSelectedGameId(e.target.value)}>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title} ({formatDateLabel(g.date)}
                {g.place ? ` @ ${g.place}` : ""})
              </option>
            ))}
          </select>

          <div className="mt-3">
            <FieldLabel>何試合目</FieldLabel>
            {matchesLoading ? (
              <div className="text-[12.5px] text-ink-soft py-2">読み込み中…</div>
            ) : (
              <div className="flex gap-1.5 flex-wrap">
                {matches.map((m) => (
                  <SegButton
                    key={m.id}
                    variant="small"
                    active={selectedMatchId === m.id}
                    onClick={() => setSelectedMatchId(m.id)}
                    className="flex-none px-3.5"
                  >
                    第{m.game_number}試合
                  </SegButton>
                ))}
                <button
                  type="button"
                  onClick={handleAddMatch}
                  disabled={addingMatch}
                  className="flex-none px-3 py-1.5 rounded-[10px] text-[11px] font-bold border border-line text-ink-soft bg-paper"
                >
                  {addingMatch ? "追加中…" : "+ 試合を追加"}
                </button>
              </div>
            )}
          </div>

          {selectedMatch && (
            <div className="mt-3">
              <FieldLabel>対戦相手</FieldLabel>
              <input
                className={inputClass()}
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                placeholder="例:○○ミニバスケットボールクラブ"
              />
            </div>
          )}

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

          <SubmitButton onClick={handleSubmit} disabled={saving || !selectedMatch}>
            {saving ? "登録中…" : "このクォーターを登録する"}
          </SubmitButton>
        </>
      )}
    </PageShell>
  );
}
