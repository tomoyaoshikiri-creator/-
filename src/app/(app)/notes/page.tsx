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
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { canAccessTab } from "@/lib/permissions";
import { playerFullName, sortPlayers } from "@/lib/format";
import type { Player, PlayerNote } from "@/lib/database.types";

export default function NotesPage() {
  const router = useRouter();
  const { userId, teamId, role } = useSession();
  const toast = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [notes, setNotes] = useState<PlayerNote[]>([]);
  const [body, setBody] = useState("");
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("players").select("*").neq("status", "OB・OG");
      const list = sortPlayers(data ?? []);
      setPlayers(list);
      setSelectedId((prev) => prev || list[0]?.id || "");
    })();
  }, []);

  const loadNotes = useCallback(async (playerId: string) => {
    if (!playerId) {
      setNotes([]);
      setLoadingNotes(false);
      return;
    }
    setLoadingNotes(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("player_notes")
      .select("*")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false });
    setNotes(data ?? []);
    setLoadingNotes(false);
  }, []);

  useEffect(() => {
    loadNotes(selectedId);
  }, [selectedId, loadNotes]);

  useEffect(() => {
    if (!canAccessTab(role, "notes")) router.replace("/schedule");
  }, [role, router]);

  async function handleSubmit() {
    if (!selectedId) {
      toast("選手を選択してください");
      return;
    }
    if (!body.trim()) {
      toast("メモを入力してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("player_notes").insert({
      team_id: teamId,
      player_id: selectedId,
      author_id: userId,
      body: body.trim(),
    });
    setSaving(false);
    if (error) {
      toast(`登録に失敗しました: ${error.message}`);
      return;
    }
    setBody("");
    toast("メモを登録しました");
    loadNotes(selectedId);
  }

  return (
    <PageShell header={<AppHeader title="選手メモ" rightSlot={<CurrentUserBadge />} />}>
      <SectionLabel>選手を選ぶ</SectionLabel>
      <select className={inputClass()} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.number ?? "-"} {playerFullName(p)}
          </option>
        ))}
      </select>

      <div className="mt-3">
        <FieldLabel>メモ内容</FieldLabel>
        <textarea
          rows={3}
          className={inputClass()}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="例:左手のレイアップが安定してきた"
        />
      </div>
      <SubmitButton onClick={handleSubmit} disabled={saving}>
        {saving ? "登録中…" : "メモを登録する"}
      </SubmitButton>

      <div className="mt-5">
        <SectionLabel>これまでのメモ</SectionLabel>
        {loadingNotes ? (
          <EmptyState>読み込み中…</EmptyState>
        ) : notes.length === 0 ? (
          <EmptyState>まだメモがありません</EmptyState>
        ) : (
          notes.map((n) => (
            <Card key={n.id}>
              <div className="text-xs text-ink-soft">{n.created_at.slice(0, 10)}</div>
              <div className="font-medium text-[13.5px] mt-1 whitespace-pre-wrap">{n.body}</div>
            </Card>
          ))
        )}
      </div>
    </PageShell>
  );
}
