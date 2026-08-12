"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState } from "@/components/ui/Card";
import { TypeTag } from "@/components/ui/Pill";
import { SegButton, SubmitButton, FieldLabel, inputClass } from "@/components/ui/SegButton";
import { canRecordGames } from "@/lib/permissions";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { scheduleMeta } from "@/lib/format";
import type { GameMatch, Schedule } from "@/lib/database.types";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: g } = await supabase.from("schedules").select("*").eq("id", gameId).single();
      setGame(g ?? null);
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

  useEffect(() => {
    if (!canRecordGames(role)) router.replace("/game/results");
  }, [role, router]);

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
  useUnsavedChangesGuard(
    selectedMatch !== undefined &&
      (opponent !== (selectedMatch.opponent ?? "") ||
        teamScoreNum !== selectedMatch.team_score ||
        opponentScoreNum !== selectedMatch.opponent_score ||
        videoUrl !== (selectedMatch.video_url ?? "")),
  );
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
          <div className="mb-3">
            <div className="font-bold text-[14.5px]">
              <TypeTag type={game.type} gameCategory={game.game_category} />
              {game.title}
            </div>
            <div className="text-xs text-ink-soft mt-1">{scheduleMeta(game)}</div>
          </div>

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
            <SubmitButton onClick={() => router.push(`/game/stats/${selectedMatch.id}`)} className="bg-orange">
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
        </>
      )}
    </PageShell>
  );
}
