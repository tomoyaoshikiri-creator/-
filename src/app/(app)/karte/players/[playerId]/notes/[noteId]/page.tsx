"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState } from "@/components/ui/Card";
import { inputClass } from "@/components/ui/SegButton";
import { ReactionButtons } from "@/components/ReactionButtons";
import { canManagePlayers } from "@/lib/permissions";
import { loadProfilesMap } from "@/lib/profiles";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { formatDateLabel } from "@/lib/format";
import type { PlayerAnalysisNote, PlayerAnalysisNoteReaction, ReactionType } from "@/lib/database.types";

export default function PlayerAnalysisNoteDetailPage() {
  const params = useParams<{ playerId: string; noteId: string }>();
  const router = useRouter();
  const { role, userId } = useSession();
  const toast = useToast();

  const [note, setNote] = useState<PlayerAnalysisNote | null>(null);
  const [reactions, setReactions] = useState<PlayerAnalysisNoteReaction[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const backHref = `/karte/players/${params.playerId}/analysis`;

  useUnsavedChangesGuard(editing && note !== null && editBody !== note.body);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: n }, profMap] = await Promise.all([
      supabase.from("player_analysis_notes").select("*").eq("id", params.noteId).maybeSingle(),
      loadProfilesMap(supabase),
    ]);
    setNote(n ?? null);
    setProfiles(profMap);
    if (n) {
      const { data: r } = await supabase.from("player_analysis_note_reactions").select("*").eq("note_id", n.id);
      setReactions(r ?? []);
    } else {
      setReactions([]);
    }
    setLoading(false);
  }, [params.noteId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleReaction(type: ReactionType) {
    if (!note) return;
    const supabase = createClient();
    const existing = reactions.find((r) => r.reaction_type === type && r.profile_id === userId);
    if (existing) {
      const { error } = await supabase.from("player_analysis_note_reactions").delete().eq("id", existing.id);
      if (error) {
        toast(`取り消しに失敗しました: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("player_analysis_note_reactions").insert({
        team_id: note.team_id,
        note_id: note.id,
        profile_id: userId,
        reaction_type: type,
      });
      if (error) {
        toast(`スタンプに失敗しました: ${error.message}`);
        return;
      }
    }
    const { data: r } = await supabase.from("player_analysis_note_reactions").select("*").eq("note_id", note.id);
    setReactions(r ?? []);
  }

  function startEdit() {
    if (!note) return;
    setEditBody(note.body);
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (!note || !editBody.trim()) {
      toast("メモを入力してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("player_analysis_notes")
      .update({ body: editBody.trim(), updated_at: new Date().toISOString() })
      .eq("id", note.id);
    setSaving(false);
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }
    toast("メモを更新しました");
    setEditing(false);
    load();
  }

  async function handleDelete() {
    if (!note) return;
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("player_analysis_notes").delete().eq("id", note.id);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    toast("メモを削除しました");
    router.replace(backHref);
  }

  if (loading) {
    return (
      <PageShell header={<AppHeader title="AI分析" variant="detail" backHref={backHref} accessBadge="coach" />}>
        <EmptyState>読み込み中…</EmptyState>
      </PageShell>
    );
  }

  if (!note) {
    return (
      <PageShell header={<AppHeader title="AI分析" variant="detail" backHref={backHref} accessBadge="coach" />}>
        <EmptyState>見つかりません</EmptyState>
      </PageShell>
    );
  }

  return (
    <PageShell header={<AppHeader title="AI分析" variant="detail" backHref={backHref} accessBadge="coach" />}>
      <Card>
        <div className="flex items-center gap-1.5 font-mono text-[10.5px] font-bold text-ink-soft tracking-wide mb-1.5">
          <span>
            {formatDateLabel(note.created_at.slice(0, 10))}
            {note.author_id && profiles[note.author_id] ? ` ・ ${profiles[note.author_id]}` : ""}
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-orange/12 text-orange text-[9.5px] font-bold tracking-wide">
            AI分析
          </span>
        </div>
        {editing ? (
          <>
            <textarea rows={5} className={inputClass()} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
            <div className="flex gap-2 mt-1.5">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 text-center py-1.5 rounded-lg font-bold text-[11px] border border-orange text-orange bg-orange/8"
              >
                {saving ? "保存中…" : "保存"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="flex-1 text-center py-1.5 rounded-lg font-bold text-[11px] border border-line text-ink-soft bg-white"
              >
                キャンセル
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{note.body}</div>
            <ReactionButtons reactions={reactions} onToggle={toggleReaction} profiles={profiles} />
            {canManagePlayers(role) && (
              <div className="flex gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={startEdit}
                  className="flex-1 text-center py-1.5 rounded-lg font-bold text-[11px] border border-line text-ink-soft bg-paper"
                >
                  編集
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex-1 text-center py-1.5 rounded-lg font-bold text-[11px] border bg-white whitespace-nowrap"
                  style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                >
                  {deleteConfirm ? "再タップで削除確定" : "削除"}
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </PageShell>
  );
}
