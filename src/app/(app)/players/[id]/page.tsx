"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SegButton, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { GRADES, POSITIONS, STATUS_OPTIONS } from "@/lib/playerOptions";
import { formatDateLabel, gradeLabel, obogCohortLabel, playerFullName } from "@/lib/format";
import type { Grade, Player, PlayerNote, PlayerStatus, Position } from "@/lib/database.types";

export default function PlayerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { userId } = useSession();
  const [player, setPlayer] = useState<Player | null>(null);
  const [notes, setNotes] = useState<PlayerNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteBody, setEditNoteBody] = useState("");
  const [savingNoteEdit, setSavingNoteEdit] = useState(false);
  const [deleteNoteConfirmId, setDeleteNoteConfirmId] = useState<string | null>(null);

  const [sei, setSei] = useState("");
  const [mei, setMei] = useState("");
  const [seiKana, setSeiKana] = useState("");
  const [meiKana, setMeiKana] = useState("");
  const [grade, setGrade] = useState("");
  const [number, setNumber] = useState("");
  const [positions, setPositions] = useState<Position[]>([]);
  const [status, setStatus] = useState<PlayerStatus>("在籍");

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: p }, { data: n }] = await Promise.all([
      supabase.from("players").select("*").eq("id", params.id).single(),
      supabase
        .from("player_notes")
        .select("*")
        .eq("player_id", params.id)
        .order("created_at", { ascending: false }),
    ]);
    setPlayer(p ?? null);
    setNotes(n ?? []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit() {
    if (!player) return;
    setSei(player.sei);
    setMei(player.mei);
    setSeiKana(player.sei_kana ?? "");
    setMeiKana(player.mei_kana ?? "");
    setGrade(player.grade ?? "");
    setNumber(player.number ?? "");
    setPositions(player.positions);
    setStatus(player.status);
    setDeleteConfirm(false);
    setEditing(true);
  }

  function togglePos(p: Position) {
    setPositions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function handleSave() {
    if (!player) return;
    if (!sei.trim() || !mei.trim()) {
      toast("氏名を入力してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("players")
      .update({
        sei: sei.trim(),
        mei: mei.trim(),
        sei_kana: seiKana.trim() || null,
        mei_kana: meiKana.trim() || null,
        grade: grade || null,
        number: number.trim() || null,
        positions,
        status,
      })
      .eq("id", player.id);
    setSaving(false);
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }
    toast("選手情報を更新しました");
    setEditing(false);
    load();
  }

  async function handleDelete() {
    if (!player) return;
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("players").delete().eq("id", player.id);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    toast("選手を削除しました");
    router.push("/players");
  }

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
      .update({ body: editNoteBody.trim() })
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
          title={player ? playerFullName(player) : "選手"}
          variant="detail"
          backHref={player?.status === "OB・OG" ? "/players/obog" : "/players"}
        />
      }
    >
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : !player ? (
        <EmptyState>選手が見つかりません</EmptyState>
      ) : editing ? (
        <>
          <SectionLabel>選手情報を編集</SectionLabel>
          <Card>
            <div className="flex gap-2">
              <div className="flex-1">
                <FieldLabel>氏</FieldLabel>
                <input className={inputClass()} value={sei} onChange={(e) => setSei(e.target.value)} />
              </div>
              <div className="flex-1">
                <FieldLabel>名</FieldLabel>
                <input className={inputClass()} value={mei} onChange={(e) => setMei(e.target.value)} />
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <div className="flex-1">
                <FieldLabel>氏(カナ)</FieldLabel>
                <input className={inputClass()} value={seiKana} onChange={(e) => setSeiKana(e.target.value)} />
              </div>
              <div className="flex-1">
                <FieldLabel>名(カナ)</FieldLabel>
                <input className={inputClass()} value={meiKana} onChange={(e) => setMeiKana(e.target.value)} />
              </div>
            </div>

            <div className="mt-3">
              <FieldLabel>学年</FieldLabel>
              {status === "OB・OG" ? (
                <input
                  type="number"
                  min={6}
                  className={inputClass()}
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                />
              ) : (
                <select className={inputClass()} value={grade} onChange={(e) => setGrade(e.target.value as Grade | "")}>
                  <option value="">選択してください</option>
                  {GRADES.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="mt-3">
              <FieldLabel>背番号(リバ)</FieldLabel>
              <input className={inputClass()} value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>

            <div className="mt-3">
              <FieldLabel>ポジション(複数選択可)</FieldLabel>
              <div className="flex gap-1.5 flex-wrap">
                {POSITIONS.map((p) => (
                  <SegButton
                    key={p}
                    variant="small"
                    active={positions.includes(p)}
                    onClick={() => togglePos(p)}
                    className="flex-none px-3.5"
                  >
                    {p}
                  </SegButton>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <FieldLabel>ステータス</FieldLabel>
              <select
                className={inputClass()}
                value={status}
                onChange={(e) => setStatus(e.target.value as PlayerStatus)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <SubmitButton onClick={handleSave} disabled={saving}>
              {saving ? "保存中…" : "保存する"}
            </SubmitButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="w-full mt-2.5 text-center py-2 rounded-[10px] font-bold text-[12.5px] border border-line bg-white text-ink-soft"
            >
              キャンセル
            </button>
          </Card>

          <div className="font-mono text-[11px] tracking-widest uppercase text-ink-soft mt-4 mb-2.5">削除</div>
          <Card>
            <button
              type="button"
              onClick={handleDelete}
              className="w-full text-center py-2 rounded-[10px] font-bold text-[12.5px] border bg-white"
              style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            >
              {deleteConfirm ? "もう一度タップで削除確定" : "この選手を削除する"}
            </button>
          </Card>
        </>
      ) : (
        <>
          <SectionLabel>基本情報</SectionLabel>
          <Card>
            <div className="text-xs text-ink-soft">
              {player.sei_kana ?? ""}
              {player.mei_kana ?? ""}
            </div>
            <div className="text-xs text-ink-soft mt-1">
              背番号 {player.number ?? "-"} /{" "}
              {player.status === "OB・OG" ? obogCohortLabel(player.grade) : gradeLabel(player.grade)}
            </div>
            <div className="text-xs text-ink-soft mt-1">
              {player.positions.length > 0 ? player.positions.join("・") : "ポジション未設定"}
            </div>
            <div className="text-xs text-ink-soft mt-1">ステータス: {player.status}</div>
          </Card>

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

          <SectionLabel>これまでのメモ</SectionLabel>
          <Card>
            {notes.length === 0 ? (
              <div className="text-xs text-ink-soft">まだメモがありません</div>
            ) : (
              notes.map((n) => (
                <div key={n.id} className="py-1.5 border-b border-line last:border-b-0">
                  {editingNoteId === n.id ? (
                    <div>
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
                    </div>
                  ) : (
                    <div
                      className="cursor-pointer"
                      onClick={() => setExpandedNoteId(expandedNoteId === n.id ? null : n.id)}
                    >
                      <div className="text-xs text-ink-soft">
                        {formatDateLabel(n.created_at.slice(0, 10))}: {n.body}
                      </div>
                      {expandedNoteId === n.id && (
                        <div className="flex gap-2 mt-1.5" onClick={(e) => e.stopPropagation()}>
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
                            className="flex-1 text-center py-1.5 rounded-[8px] font-bold text-[11px] border bg-white"
                            style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                          >
                            {deleteNoteConfirmId === n.id ? "もう一度タップで削除確定" : "削除"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </Card>

          <SubmitButton onClick={startEdit}>編集する</SubmitButton>
        </>
      )}
    </PageShell>
  );
}
