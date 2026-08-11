"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState } from "@/components/ui/Card";
import { NumChip } from "@/components/ui/Pill";
import { SegButton, SubmitButton, FieldLabel, inputClass } from "@/components/ui/SegButton";
import { canRecordGames } from "@/lib/permissions";
import { playerFullName, sortPlayers } from "@/lib/format";
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

export default function GameDetailPage() {
  const params = useParams<{ id: string }>();
  const gameId = params.id;
  const router = useRouter();
  const { teamId, role } = useSession();
  const toast = useToast();
  const [game, setGame] = useState<Schedule | null>(null);
  const [matches, setMatches] = useState<GameMatch[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [addingMatch, setAddingMatch] = useState(false);
  const [opponent, setOpponent] = useState("");
  const [teamScore, setTeamScore] = useState("");
  const [opponentScore, setOpponentScore] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [savingMatch, setSavingMatch] = useState(false);
  const [quarter, setQuarter] = useState(1);
  const [players, setPlayers] = useState<Player[]>([]);
  const [starters, setStarters] = useState<string[]>([]);
  const [subs, setSubs] = useState<string[]>([]);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [memberEditing, setMemberEditing] = useState(false);
  const [memberExpanded, setMemberExpanded] = useState(false);
  const [deleteRecordConfirm, setDeleteRecordConfirm] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: g }, { data: p }, { data: att }] = await Promise.all([
        supabase.from("schedules").select("*").eq("id", gameId).single(),
        supabase.from("players").select("*"),
        supabase.from("attendances").select("player_id, status").eq("schedule_id", gameId).not("player_id", "is", null),
      ]);
      setGame(g ?? null);
      setPlayers(sortPlayers((p ?? []).filter((x) => x.status === "在籍")));
      const map: Record<string, AttendanceStatus> = {};
      (att ?? []).forEach((a) => {
        if (a.player_id) map[a.player_id] = a.status;
      });
      setAttendanceStatus(map);
      setLoading(false);
    })();
  }, [gameId]);

  const loadMatches = useCallback(
    async (id: string) => {
      if (!id) {
        setMatches([]);
        setSelectedMatchId("");
        return;
      }
      setMatchesLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("game_matches")
        .select("*")
        .eq("schedule_id", id)
        .order("game_number", { ascending: true });
      let list = data ?? [];
      if (list.length === 0) {
        const { data: created } = await supabase
          .from("game_matches")
          .insert({ team_id: teamId, schedule_id: id, game_number: 1 })
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
    loadMatches(gameId);
  }, [gameId, loadMatches]);

  useEffect(() => {
    const m = matches.find((x) => x.id === selectedMatchId);
    setOpponent(m?.opponent ?? "");
    setTeamScore(m?.team_score != null ? String(m.team_score) : "");
    setOpponentScore(m?.opponent_score != null ? String(m.opponent_score) : "");
    setVideoUrl(m?.video_url ?? "");
  }, [selectedMatchId, matches]);

  const loadRecord = useCallback(async (matchId: string, q: number) => {
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
      .eq("quarter", q)
      .maybeSingle();
    setStarters(data?.starter_player_ids ?? []);
    setSubs(data?.sub_player_ids ?? []);
    setRecordId(data?.id ?? null);
  }, []);

  useEffect(() => {
    loadRecord(selectedMatchId, quarter);
  }, [selectedMatchId, quarter, loadRecord]);

  useEffect(() => {
    if (!canRecordGames(role)) router.replace("/game/results");
  }, [role, router]);

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

  async function handleAddMatch() {
    if (!gameId) return;
    setAddingMatch(true);
    const supabase = createClient();
    const nextNumber = (matches[matches.length - 1]?.game_number ?? 0) + 1;
    const { data, error } = await supabase
      .from("game_matches")
      .insert({ team_id: teamId, schedule_id: gameId, game_number: nextNumber })
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
    const { data, error } = await supabase
      .from("game_records")
      .upsert(
        {
          team_id: teamId,
          match_id: selectedMatchId,
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

  async function handleSaveMatch() {
    if (!selectedMatchId) return;
    setSavingMatch(true);
    const supabase = createClient();
    const teamScoreNum = teamScore.trim() === "" ? null : Number(teamScore);
    const opponentScoreNum = opponentScore.trim() === "" ? null : Number(opponentScore);
    const { error } = await supabase
      .from("game_matches")
      .update({
        opponent: opponent.trim() || null,
        team_score: teamScoreNum,
        opponent_score: opponentScoreNum,
        video_url: videoUrl.trim() || null,
      })
      .eq("id", selectedMatchId);
    setSavingMatch(false);
    if (error) {
      toast(`保存に失敗しました: ${error.message}`);
      return;
    }
    setMatches((prev) =>
      prev.map((m) =>
        m.id === selectedMatchId
          ? {
              ...m,
              opponent: opponent.trim() || null,
              team_score: teamScoreNum,
              opponent_score: opponentScoreNum,
              video_url: videoUrl.trim() || null,
            }
          : m,
      ),
    );
    toast("対戦結果を保存しました");
  }

  const selectedMatch = matches.find((m) => m.id === selectedMatchId);
  const teamScoreNum = teamScore.trim() === "" ? null : Number(teamScore);
  const opponentScoreNum = opponentScore.trim() === "" ? null : Number(opponentScore);
  const matchResult =
    teamScoreNum !== null && opponentScoreNum !== null
      ? teamScoreNum > opponentScoreNum
        ? "勝ち"
        : teamScoreNum < opponentScoreNum
          ? "負け"
          : "引き分け"
      : null;

  return (
    <PageShell header={<AppHeader title={game?.title ?? "試合記録"} variant="detail" backHref="/game" accessBadge="coach" />}>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : !game ? (
        <EmptyState>試合が見つかりません</EmptyState>
      ) : (
        <>
          <div className="mt-1">
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
            <SubmitButton
              onClick={() => router.push(`/game/stats/${selectedMatch.id}`)}
              className="bg-orange"
            >
              スタッツを入力
            </SubmitButton>
          )}

          {selectedMatch && (
            <div className="mt-3">
              <FieldLabel>対戦相手・結果</FieldLabel>
              <Card>
                <input
                  className={inputClass()}
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  placeholder="例:○○ミニバスケットボールクラブ"
                />

                <div className="mt-3 flex gap-2">
                  <div className="flex-1">
                    <FieldLabel>自チーム得点</FieldLabel>
                    <input
                      type="number"
                      min={0}
                      className={inputClass()}
                      value={teamScore}
                      onChange={(e) => setTeamScore(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <FieldLabel>相手得点</FieldLabel>
                    <input
                      type="number"
                      min={0}
                      className={inputClass()}
                      value={opponentScore}
                      onChange={(e) => setOpponentScore(e.target.value)}
                    />
                  </div>
                </div>

                {matchResult && (
                  <div
                    className="mt-2 text-center font-bold text-[13px] py-1.5 rounded-[8px] bg-paper"
                    style={{
                      color:
                        matchResult === "勝ち"
                          ? "var(--green)"
                          : matchResult === "負け"
                            ? "var(--danger)"
                            : "var(--ink-soft)",
                    }}
                  >
                    {matchResult}
                  </div>
                )}

                <div className="mt-3">
                  <FieldLabel>動画URL</FieldLabel>
                  <input
                    className={inputClass()}
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="例:https://www.youtube.com/playlist?list=..."
                  />
                </div>

                <SubmitButton onClick={handleSaveMatch} disabled={savingMatch}>
                  {savingMatch ? "保存中…" : "対戦結果を保存する"}
                </SubmitButton>
              </Card>
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

          {recordId && !memberEditing ? (
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

              <SubmitButton onClick={handleSubmit} disabled={saving || !selectedMatch}>
                {saving ? "登録中…" : "このクォーターを登録する"}
              </SubmitButton>
              {memberEditing && (
                <button
                  type="button"
                  onClick={() => loadRecord(selectedMatchId, quarter)}
                  disabled={saving}
                  className="w-full mt-2.5 text-center py-2 rounded-[10px] font-bold text-[12.5px] border border-line bg-white text-ink-soft"
                >
                  キャンセル
                </button>
              )}
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
