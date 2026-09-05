"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { TypeTag } from "@/components/ui/Pill";
import { SegButton, SubmitButton, FieldLabel, inputClass } from "@/components/ui/SegButton";
import { ReactionButtons } from "@/components/ReactionButtons";
import { canRecordGames } from "@/lib/permissions";
import { usesDetailedBasketballStats } from "@/lib/sport";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { loadProfilesMap } from "@/lib/profiles";
import { formatDateLabel, scheduleMeta } from "@/lib/format";
import type { GameMatch, GameMatchNote, GameMatchNoteReaction, ReactionType, Schedule } from "@/lib/database.types";

export default function GameDetailPage() {
  const params = useParams<{ id: string }>();
  const gameId = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId, teamId, role, sport } = useSession();
  const toast = useToast();
  const [game, setGame] = useState<Schedule | null>(null);
  const [matches, setMatches] = useState<GameMatch[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  // 試合結果一覧から特定の試合をタップして来た場合、その試合を初期選択にする(一度使ったら消費する)。
  // refにするのはstateにするとloadMatchesのdepsが変わって再フェッチが走ってしまうため。
  const pendingMatchIdRef = useRef(searchParams.get("matchId") ?? "");
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [addingMatch, setAddingMatch] = useState(false);
  const [opponent, setOpponent] = useState("");
  const [teamScore, setTeamScore] = useState("");
  const [opponentScore, setOpponentScore] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [savingMatch, setSavingMatch] = useState(false);
  const [deletingMatch, setDeletingMatch] = useState(false);
  const [deleteMatchConfirmId, setDeleteMatchConfirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<GameMatchNote[]>([]);
  const [noteReactions, setNoteReactions] = useState<GameMatchNoteReaction[]>([]);
  const [noteProfiles, setNoteProfiles] = useState<Record<string, string>>({});
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteBody, setEditNoteBody] = useState("");
  const [savingNoteEdit, setSavingNoteEdit] = useState(false);
  const [deleteNoteConfirmId, setDeleteNoteConfirmId] = useState<string | null>(null);

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
      const pendingMatchId = pendingMatchIdRef.current;
      pendingMatchIdRef.current = "";
      setSelectedMatchId((prev) => {
        if (pendingMatchId && list.some((m) => m.id === pendingMatchId)) return pendingMatchId;
        return list.some((m) => m.id === prev) ? prev : (list[0]?.id ?? "");
      });
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

  const loadNotes = useCallback(async (matchId: string) => {
    if (!matchId) {
      setNotes([]);
      setNoteReactions([]);
      return;
    }
    const supabase = createClient();
    const [{ data: n }, profMap] = await Promise.all([
      supabase
        .from("game_match_notes")
        .select("*")
        .eq("game_match_id", matchId)
        .order("created_at", { ascending: false }),
      loadProfilesMap(supabase),
    ]);
    setNotes(n ?? []);
    setNoteProfiles(profMap);
    const noteIds = (n ?? []).map((note) => note.id);
    if (noteIds.length > 0) {
      const { data: r } = await supabase.from("game_match_note_reactions").select("*").in("note_id", noteIds);
      setNoteReactions(r ?? []);
    } else {
      setNoteReactions([]);
    }
  }, []);

  useEffect(() => {
    setNoteBody("");
    setShowAddNote(false);
    setEditingNoteId(null);
    setExpandedNoteId(null);
    loadNotes(selectedMatchId);
  }, [selectedMatchId, loadNotes]);

  useUnsavedChangesGuard(noteBody.trim() !== "");
  const editingNote = notes.find((n) => n.id === editingNoteId);
  useUnsavedChangesGuard(editingNote !== undefined && editNoteBody !== editingNote.body);

  async function loadNoteReactions() {
    const noteIds = notes.map((n) => n.id);
    if (noteIds.length === 0) return;
    const supabase = createClient();
    const { data } = await supabase.from("game_match_note_reactions").select("*").in("note_id", noteIds);
    setNoteReactions(data ?? []);
  }

  async function toggleNoteReaction(noteId: string, type: ReactionType) {
    const supabase = createClient();
    const existing = noteReactions.find(
      (r) => r.note_id === noteId && r.reaction_type === type && r.profile_id === userId,
    );
    if (existing) {
      const { error } = await supabase.from("game_match_note_reactions").delete().eq("id", existing.id);
      if (error) {
        toast(`取り消しに失敗しました: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("game_match_note_reactions").insert({
        team_id: teamId,
        note_id: noteId,
        profile_id: userId,
        reaction_type: type,
      });
      if (error) {
        toast(`スタンプに失敗しました: ${error.message}`);
        return;
      }
    }
    loadNoteReactions();
  }

  async function handleAddNote() {
    if (!selectedMatchId) return;
    if (!noteBody.trim()) {
      toast("コーチメモを入力してください");
      return;
    }
    setSavingNote(true);
    const supabase = createClient();
    const { error } = await supabase.from("game_match_notes").insert({
      team_id: teamId,
      game_match_id: selectedMatchId,
      author_id: userId,
      body: noteBody.trim(),
    });
    setSavingNote(false);
    if (error) {
      toast(`登録に失敗しました: ${error.message}`);
      return;
    }
    setNoteBody("");
    setShowAddNote(false);
    toast("コーチメモを登録しました");
    loadNotes(selectedMatchId);
  }

  function startEditNote(n: GameMatchNote) {
    setEditingNoteId(n.id);
    setEditNoteBody(n.body);
    setExpandedNoteId(null);
  }

  async function handleSaveNoteEdit(noteId: string) {
    if (!editNoteBody.trim()) {
      toast("コーチメモを入力してください");
      return;
    }
    setSavingNoteEdit(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("game_match_notes")
      .update({ body: editNoteBody.trim(), updated_at: new Date().toISOString() })
      .eq("id", noteId);
    setSavingNoteEdit(false);
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }
    toast("コーチメモを更新しました");
    setEditingNoteId(null);
    loadNotes(selectedMatchId);
  }

  async function handleDeleteNote(noteId: string) {
    if (deleteNoteConfirmId !== noteId) {
      setDeleteNoteConfirmId(noteId);
      setTimeout(() => setDeleteNoteConfirmId((cur) => (cur === noteId ? null : cur)), 3000);
      return;
    }
    setDeleteNoteConfirmId(null);
    const supabase = createClient();
    const { error } = await supabase.from("game_match_notes").delete().eq("id", noteId);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    toast("コーチメモを削除しました");
    setExpandedNoteId(null);
    loadNotes(selectedMatchId);
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

  async function handleDeleteMatch() {
    if (!selectedMatchId) return;
    if (deleteMatchConfirmId !== selectedMatchId) {
      setDeleteMatchConfirmId(selectedMatchId);
      setTimeout(() => setDeleteMatchConfirmId((cur) => (cur === selectedMatchId ? null : cur)), 3000);
      return;
    }
    setDeleteMatchConfirmId(null);
    setDeletingMatch(true);
    const supabase = createClient();
    const { error } = await supabase.from("game_matches").delete().eq("id", selectedMatchId);
    setDeletingMatch(false);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    toast("試合を削除しました");
    // 削除した試合が最後の1件だった場合、loadMatches()が自動的に第1試合を作り直す。
    loadMatches(gameId);
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
                  className="flex-none px-3 py-1.5 rounded-lg text-[11px] font-bold border border-line text-ink-soft bg-paper"
                >
                  {addingMatch ? "追加中…" : "+ 試合を追加"}
                </button>
              </div>
            )}
          </div>

          {selectedMatch && (
            <SubmitButton
              onClick={() =>
                router.push(
                  usesDetailedBasketballStats(sport)
                    ? `/game/stats/${selectedMatch.id}`
                    : `/game/custom-stats/${selectedMatch.id}`,
                )
              }
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
                    className="mt-2 text-center font-bold text-[13px] py-1.5 rounded-lg bg-paper"
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

                <button
                  type="button"
                  onClick={handleDeleteMatch}
                  disabled={deletingMatch}
                  className={`mt-2.5 w-full text-center py-2 rounded-lg font-bold text-[12px] border bg-white disabled:opacity-50 ${
                    deleteMatchConfirmId === selectedMatch.id ? "" : "opacity-50"
                  }`}
                  style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                >
                  {deletingMatch
                    ? "削除中…"
                    : deleteMatchConfirmId === selectedMatch.id
                      ? "再タップで削除確定"
                      : `第${selectedMatch.game_number}試合を削除する`}
                </button>
              </Card>
            </div>
          )}

          {selectedMatch && (
            <div className="mt-3">
              <SectionLabel>コーチメモ</SectionLabel>
              {notes.length === 0 ? (
                <Card>
                  <div className="text-xs text-ink-soft">まだコーチメモがありません</div>
                </Card>
              ) : (
                notes.map((n) =>
                  editingNoteId === n.id ? (
                    <Card key={n.id}>
                      <textarea
                        rows={3}
                        className={inputClass()}
                        value={editNoteBody}
                        onChange={(e) => setEditNoteBody(e.target.value)}
                      />
                      <div className="flex gap-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() => handleSaveNoteEdit(n.id)}
                          disabled={savingNoteEdit}
                          className="flex-1 text-center py-1.5 rounded-lg font-bold text-[11px] border border-orange text-orange bg-orange/8"
                        >
                          {savingNoteEdit ? "保存中…" : "保存"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingNoteId(null)}
                          disabled={savingNoteEdit}
                          className="flex-1 text-center py-1.5 rounded-lg font-bold text-[11px] border border-line text-ink-soft bg-white"
                        >
                          キャンセル
                        </button>
                      </div>
                    </Card>
                  ) : (
                    <Card
                      key={n.id}
                      className="cursor-pointer"
                      onClick={() => setExpandedNoteId(expandedNoteId === n.id ? null : n.id)}
                    >
                      <div className="font-mono text-[10.5px] font-bold text-ink-soft tracking-wide mb-1.5">
                        {formatDateLabel(n.created_at.slice(0, 10))}
                        {n.author_id && noteProfiles[n.author_id] ? ` ・ ${noteProfiles[n.author_id]}` : ""}
                      </div>
                      <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{n.body}</div>
                      <ReactionButtons
                        reactions={noteReactions.filter((r) => r.note_id === n.id)}
                        onToggle={(type) => toggleNoteReaction(n.id, type)}
                        profiles={noteProfiles}
                      />
                      {expandedNoteId === n.id && (
                        <div className="flex gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => startEditNote(n)}
                            className="flex-1 text-center py-1.5 rounded-lg font-bold text-[11px] border border-line text-ink-soft bg-paper"
                          >
                            編集
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(n.id)}
                            className="flex-1 text-center py-1.5 rounded-lg font-bold text-[11px] border bg-white whitespace-nowrap"
                            style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                          >
                            {deleteNoteConfirmId === n.id ? "再タップで削除確定" : "削除"}
                          </button>
                        </div>
                      )}
                    </Card>
                  ),
                )
              )}
              {showAddNote ? (
                <Card>
                  <textarea
                    rows={3}
                    className={inputClass()}
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="例:第2Q以降、球際の寄せが速くなった"
                  />
                  <div className="flex gap-2 mt-3">
                    <SubmitButton onClick={handleAddNote} disabled={savingNote} className="!mt-0 flex-1">
                      {savingNote ? "登録中…" : "登録する"}
                    </SubmitButton>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddNote(false);
                        setNoteBody("");
                      }}
                      className="flex-1 text-center py-2.5 rounded-lg font-bold text-[13px] border border-line text-ink-soft bg-white"
                    >
                      キャンセル
                    </button>
                  </div>
                </Card>
              ) : (
                <SubmitButton onClick={() => setShowAddNote(true)}>コーチメモを登録する</SubmitButton>
              )}
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
