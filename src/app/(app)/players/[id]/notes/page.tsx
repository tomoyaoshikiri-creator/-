"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { SubmitButton, inputClass } from "@/components/ui/SegButton";
import { ReactionButtons } from "@/components/ReactionButtons";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { canManagePlayers } from "@/lib/permissions";
import { formatDateLabel, playerFullName, sortPlayers } from "@/lib/format";
import { loadProfilesMap } from "@/lib/profiles";
import { markItemSeen } from "@/lib/itemBadges";
import type { Player, PlayerNote, PlayerNoteReaction, ReactionType } from "@/lib/database.types";

export default function PlayerNotesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { role, userId } = useSession();
  const toast = useToast();
  const [player, setPlayer] = useState<Player | null>(null);
  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [notes, setNotes] = useState<PlayerNote[]>([]);
  const [reactions, setReactions] = useState<PlayerNoteReaction[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteBody, setEditNoteBody] = useState("");
  const [savingNoteEdit, setSavingNoteEdit] = useState(false);
  const [deleteNoteConfirmId, setDeleteNoteConfirmId] = useState<string | null>(null);

  useUnsavedChangesGuard(noteBody.trim() !== "");
  const editingNote = notes.find((n) => n.id === editingNoteId);
  useUnsavedChangesGuard(editingNote !== undefined && editNoteBody !== editingNote.body);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: p }, { data: n }, profMap] = await Promise.all([
      supabase.from("players").select("*").eq("id", params.id).single(),
      supabase
        .from("player_notes")
        .select("*")
        .eq("player_id", params.id)
        .order("created_at", { ascending: false }),
      loadProfilesMap(supabase),
    ]);
    setPlayer(p ?? null);
    if (p) {
      const { data: siblings } = await supabase
        .from("players")
        .select("id, grade, number")
        .eq("status", p.status);
      const ordered = sortPlayers(siblings ?? []);
      const idx = ordered.findIndex((s) => s.id === p.id);
      setPrevId(idx > 0 ? ordered[idx - 1].id : null);
      setNextId(idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1].id : null);
    } else {
      setPrevId(null);
      setNextId(null);
    }
    setNotes(n ?? []);
    setProfiles(profMap);
    const noteIds = (n ?? []).map((note) => note.id);
    if (noteIds.length > 0) {
      const { data: r } = await supabase.from("player_note_reactions").select("*").in("note_id", noteIds);
      setReactions(r ?? []);
    } else {
      setReactions([]);
    }
    setLoading(false);
  }, [params.id]);

  async function loadReactions() {
    const noteIds = notes.map((n) => n.id);
    if (noteIds.length === 0) return;
    const supabase = createClient();
    const { data } = await supabase.from("player_note_reactions").select("*").in("note_id", noteIds);
    setReactions(data ?? []);
  }

  async function toggleReaction(noteId: string, type: ReactionType) {
    if (!player) return;
    const supabase = createClient();
    const existing = reactions.find(
      (r) => r.note_id === noteId && r.reaction_type === type && r.profile_id === userId,
    );
    if (existing) {
      const { error } = await supabase.from("player_note_reactions").delete().eq("id", existing.id);
      if (error) {
        toast(`取り消しに失敗しました: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("player_note_reactions").insert({
        team_id: player.team_id,
        note_id: noteId,
        profile_id: userId,
        reaction_type: type,
      });
      if (error) {
        toast(`スタンプに失敗しました: ${error.message}`);
        return;
      }
    }
    loadReactions();
  }

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    markItemSeen(userId, "player_notes", params.id);
  }, [userId, params.id]);

  useEffect(() => {
    if (!canManagePlayers(role)) router.replace("/players");
  }, [role, router]);

  async function handleAddNote() {
    if (!player) return;
    if (!noteBody.trim()) {
      toast("メモを入力してください");
      return;
    }
    setSavingNote(true);
    const supabase = createClient();
    const { error } = await supabase.from("player_notes").insert({
      team_id: player.team_id,
      player_id: player.id,
      author_id: userId,
      body: noteBody.trim(),
    });
    setSavingNote(false);
    if (error) {
      toast(`登録に失敗しました: ${error.message}`);
      return;
    }
    setNoteBody("");
    toast("メモを登録しました");
    load();
  }

  function startEditNote(n: PlayerNote) {
    setEditingNoteId(n.id);
    setEditNoteBody(n.body);
  }

  async function handleSaveNoteEdit(noteId: string) {
    if (!editNoteBody.trim()) {
      toast("メモを入力してください");
      return;
    }
    setSavingNoteEdit(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("player_notes")
      .update({ body: editNoteBody.trim(), updated_at: new Date().toISOString() })
      .eq("id", noteId);
    setSavingNoteEdit(false);
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }
    toast("メモを更新しました");
    setEditingNoteId(null);
    load();
  }

  async function handleDeleteNote(noteId: string) {
    if (deleteNoteConfirmId !== noteId) {
      setDeleteNoteConfirmId(noteId);
      setTimeout(() => setDeleteNoteConfirmId((cur) => (cur === noteId ? null : cur)), 3000);
      return;
    }
    setDeleteNoteConfirmId(null);
    const supabase = createClient();
    const { error } = await supabase.from("player_notes").delete().eq("id", noteId);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    toast("メモを削除しました");
    setExpandedNoteId(null);
    load();
  }

  return (
    <PageShell
      header={
        <AppHeader
          title={player ? `${playerFullName(player)}のメモ` : "選手メモ"}
          variant="detail"
          backHref={`/players/${params.id}`}
          accessBadge="coach"
        />
      }
    >
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : !player ? (
        <EmptyState>選手が見つかりません</EmptyState>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            {prevId ? (
              <Link
                href={`/players/${prevId}/notes`}
                aria-label="前の選手"
                className="w-[30px] h-[30px] rounded-lg bg-white border border-line flex items-center justify-center text-base text-navy"
              >
                ‹
              </Link>
            ) : (
              <span className="w-[30px] h-[30px] rounded-lg bg-white border border-line flex items-center justify-center text-base text-line">
                ‹
              </span>
            )}
            {nextId ? (
              <Link
                href={`/players/${nextId}/notes`}
                aria-label="次の選手"
                className="w-[30px] h-[30px] rounded-lg bg-white border border-line flex items-center justify-center text-base text-navy"
              >
                ›
              </Link>
            ) : (
              <span className="w-[30px] h-[30px] rounded-lg bg-white border border-line flex items-center justify-center text-base text-line">
                ›
              </span>
            )}
          </div>

          <SectionLabel>これまでのメモ</SectionLabel>
          {notes.length === 0 ? (
            <Card>
              <div className="text-xs text-ink-soft">まだメモがありません</div>
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
                      className="flex-1 text-center py-1.5 rounded-[8px] font-bold text-[11px] border border-orange text-orange bg-orange/8"
                    >
                      {savingNoteEdit ? "保存中…" : "保存"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingNoteId(null)}
                      disabled={savingNoteEdit}
                      className="flex-1 text-center py-1.5 rounded-[8px] font-bold text-[11px] border border-line text-ink-soft bg-white"
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
                    {n.author_id && profiles[n.author_id] ? ` ・ ${profiles[n.author_id]}` : ""}
                  </div>
                  <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{n.body}</div>
                  <ReactionButtons
                    reactions={reactions.filter((r) => r.note_id === n.id)}
                    onToggle={(type) => toggleReaction(n.id, type)}
                    profiles={profiles}
                  />
                  {expandedNoteId === n.id && (
                    <div className="flex gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => startEditNote(n)}
                        className="flex-1 text-center py-1.5 rounded-[8px] font-bold text-[11px] border border-line text-ink-soft bg-paper"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(n.id)}
                        className="flex-1 text-center py-1.5 rounded-[8px] font-bold text-[11px] border bg-white whitespace-nowrap"
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

          <SectionLabel>メモを追加</SectionLabel>
          <Card>
            <textarea
              rows={3}
              className={inputClass()}
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="例:左手のレイアップが安定してきた"
            />
            <SubmitButton onClick={handleAddNote} disabled={savingNote}>
              {savingNote ? "登録中…" : "メモを登録する"}
            </SubmitButton>
          </Card>
        </>
      )}
    </PageShell>
  );
}
