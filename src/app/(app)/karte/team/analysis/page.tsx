"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { InlineSelect } from "@/components/ui/InlineSelect";
import { ChevronRightIcon } from "@/components/icons";
import { ReactionButtons, ReactionSummary } from "@/components/ReactionButtons";
import { AiUsageIndicator } from "@/components/AiUsageIndicator";
import { CollapsibleList } from "@/components/CollapsibleList";
import { canManagePlayers, canViewKarte } from "@/lib/permissions";
import { hasAiAnalysisAccess, hasKarteTabAccess } from "@/lib/plan";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { hasCachedValue, useCachedState } from "@/lib/pageCache";
import { loadProfilesMap } from "@/lib/profiles";
import { isNewSincePrevious, markItemSeenAndGetPrevious } from "@/lib/itemBadges";
import { NewBadge } from "@/components/ui/Pill";
import { fiscalYearOf, formatDateLabel, todayDateStr } from "@/lib/format";
import type { ReactionType, TeamAnalysisNote, TeamAnalysisNoteReaction } from "@/lib/database.types";
import { buildTeamCopyText } from "@/lib/ai/buildCopyText";
import { collectTeamAnalysisData } from "@/lib/ai/collect";
import { planKindFor } from "@/lib/ai/types";
import { AddFeedbackModal } from "../../AddFeedbackModal";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());
const FISCAL_YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_FISCAL_YEAR - 4 + i);

export default function TeamAnalysisPage() {
  const router = useRouter();
  const { role, userId, teamId, plan, sport } = useSession();
  const toast = useToast();
  const isStaff = canViewKarte(role);

  useEffect(() => {
    if (!isStaff || !hasKarteTabAccess(plan) || !hasAiAnalysisAccess(plan)) router.replace("/karte/team");
  }, [isStaff, plan, router]);

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisFiscalYear, setAnalysisFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [analysisPrompt, setAnalysisPrompt] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiUsage, setAiUsage] = useState<{ used: number; limit: number } | null>(null);

  const [analysisNotes, setAnalysisNotes] = useCachedState<TeamAnalysisNote[]>("karteTeam:notes", []);
  const [noteReactions, setNoteReactions] = useCachedState<TeamAnalysisNoteReaction[]>(
    "karteTeam:noteReactions",
    [],
  );
  const [noteProfiles, setNoteProfiles] = useCachedState<Record<string, string>>("karteTeam:noteProfiles", {});
  const [notesLoading, setNotesLoading] = useState(() => !hasCachedValue("karteTeam:notes"));
  const [addFeedbackOpen, setAddFeedbackOpen] = useState(false);
  const [showAllAiNotes, setShowAllAiNotes] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteBody, setEditNoteBody] = useState("");
  const [savingNoteEdit, setSavingNoteEdit] = useState(false);
  const [deleteNoteConfirmId, setDeleteNoteConfirmId] = useState<string | null>(null);
  const [prevSeenAt, setPrevSeenAt] = useState<string | null>(null);

  const editingNote = analysisNotes.find((n) => n.id === editingNoteId);
  useUnsavedChangesGuard(editingNote !== undefined && editNoteBody !== editingNote.body);
  const aiNotes = analysisNotes.filter((n) => n.source === "ai");
  const staffNotes = analysisNotes.filter((n) => n.source !== "ai");

  const loadNotes = useCallback(async () => {
    if (!hasCachedValue("karteTeam:notes")) setNotesLoading(true);
    const supabase = createClient();
    const [{ data: notes }, profMap] = await Promise.all([
      supabase.from("team_analysis_notes").select("*").order("created_at", { ascending: false }),
      loadProfilesMap(supabase),
    ]);
    setAnalysisNotes(notes ?? []);
    setNoteProfiles(profMap);
    const noteIds = (notes ?? []).map((n) => n.id);
    if (noteIds.length > 0) {
      const { data: r } = await supabase.from("team_analysis_note_reactions").select("*").in("note_id", noteIds);
      setNoteReactions(r ?? []);
    } else {
      setNoteReactions([]);
    }
    setNotesLoading(false);
  }, [setAnalysisNotes, setNoteProfiles, setNoteReactions]);

  async function loadNoteReactions() {
    const noteIds = analysisNotes.map((n) => n.id);
    if (noteIds.length === 0) return;
    const supabase = createClient();
    const { data } = await supabase.from("team_analysis_note_reactions").select("*").in("note_id", noteIds);
    setNoteReactions(data ?? []);
  }

  async function toggleNoteReaction(noteId: string, type: ReactionType) {
    const supabase = createClient();
    const existing = noteReactions.find(
      (r) => r.note_id === noteId && r.reaction_type === type && r.profile_id === userId,
    );
    if (existing) {
      const { error } = await supabase.from("team_analysis_note_reactions").delete().eq("id", existing.id);
      if (error) {
        toast(`取り消しに失敗しました: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("team_analysis_note_reactions").insert({
        team_id: teamId,
        note_id: noteId,
        profile_id: userId,
        reaction_type: type,
      });
      if (error) {
        toast(`スタンプに失敗しました: ${error.message}`);
        return;
      }
      // リアクションはteam_analysis_notes自体を更新しないため、そのままだと一覧の
      // NEW表示(created_at/updated_atを見ている)に反映されない。updated_atを更新して
      // 拾われるようにする(失敗してもリアクション自体は成功しているため、ベスト
      // エフォートでエラー表示はしない)。
      await supabase.from("team_analysis_notes").update({ updated_at: new Date().toISOString() }).eq("id", noteId);
    }
    loadNoteReactions();
  }

  useEffect(() => {
    if (isStaff) loadNotes();
  }, [isStaff, loadNotes]);

  useEffect(() => {
    if (isStaff) markItemSeenAndGetPrevious(userId, "team_analysis", teamId).then(setPrevSeenAt);
  }, [isStaff, userId, teamId]);

  useEffect(() => {
    if (!(role === "管理者" && hasAiAnalysisAccess(plan))) return;
    (async () => {
      const res = await fetch("/api/ai-analysis");
      if (!res.ok) return;
      const data = await res.json();
      setAiUsage({ used: data.usedThisMonth, limit: data.monthlyLimit });
    })();
  }, [role, plan]);

  async function handleGenerateAiAnalysis() {
    setAiGenerating(true);
    try {
      const res = await fetch("/api/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "team", fiscalYear: CURRENT_FISCAL_YEAR, requestId: crypto.randomUUID() }),
      });
      const resData = await res.json();
      if (!res.ok) {
        toast(resData.error ?? "AI分析の生成に失敗しました");
        return;
      }
      setAiUsage({ used: resData.usedThisMonth, limit: resData.monthlyLimit });
      toast("AI分析を生成し、フィードバック欄に追加しました");
      loadNotes();
    } catch {
      toast("AI分析の生成に失敗しました");
    } finally {
      setAiGenerating(false);
    }
  }

  async function handleCopyAnalysis() {
    const planKind = planKindFor(plan) ?? "proAiPlus";
    setAnalysisLoading(true);
    try {
      const supabase = createClient();
      const data = await collectTeamAnalysisData(supabase, { fiscalYear: analysisFiscalYear, sport, planKind });
      const text = buildTeamCopyText(data, analysisPrompt);
      await navigator.clipboard.writeText(text);
      toast("分析用テキストをコピーしました");
      setAnalysisOpen(false);
    } catch {
      toast("コピーに失敗しました");
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function handleAddNote(body: string) {
    const supabase = createClient();
    const { error } = await supabase.from("team_analysis_notes").insert({
      team_id: teamId,
      author_id: userId,
      body,
    });
    return { error: error?.message ?? null };
  }

  function startEditNote(n: TeamAnalysisNote) {
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
      .from("team_analysis_notes")
      .update({ body: editNoteBody.trim(), updated_at: new Date().toISOString() })
      .eq("id", noteId);
    setSavingNoteEdit(false);
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }
    toast("メモを更新しました");
    setEditingNoteId(null);
    loadNotes();
  }

  async function handleDeleteNote(noteId: string) {
    if (deleteNoteConfirmId !== noteId) {
      setDeleteNoteConfirmId(noteId);
      setTimeout(() => setDeleteNoteConfirmId((cur) => (cur === noteId ? null : cur)), 3000);
      return;
    }
    setDeleteNoteConfirmId(null);
    const supabase = createClient();
    const { error } = await supabase.from("team_analysis_notes").delete().eq("id", noteId);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    toast("メモを削除しました");
    setExpandedNoteId(null);
    loadNotes();
  }

  return (
    <PageShell header={<AppHeader title="チーム分析" variant="detail" backHref="/karte/team" accessBadge="coach" />}>
      {role === "管理者" && hasAiAnalysisAccess(plan) && (
        <>
          <SubmitButton
            onClick={handleGenerateAiAnalysis}
            disabled={aiGenerating || (aiUsage !== null && aiUsage.used >= aiUsage.limit)}
          >
            {aiGenerating ? "AI分析を生成中…" : "AI分析を生成する"}
          </SubmitButton>
          {aiUsage && <AiUsageIndicator used={aiUsage.used} limit={aiUsage.limit} />}
        </>
      )}

      {role === "管理者" && hasAiAnalysisAccess(plan) && (
        <button
          type="button"
          onClick={() => setAnalysisOpen(true)}
          className="w-full text-left bg-orange/8 border border-orange rounded-lg px-4 py-[7px] mt-2.5 mb-2.5 flex items-center justify-between"
        >
          <div className="font-bold text-[12.5px] text-orange">分析用データ抽出〈全体分〉</div>
          <ChevronRightIcon className="w-3.5 h-3.5 text-orange flex-shrink-0" />
        </button>
      )}

      <SectionLabel>チームAI分析</SectionLabel>

      {notesLoading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : aiNotes.length === 0 ? (
        <Card>
          <div className="text-xs text-ink-soft">まだAI分析がありません</div>
        </Card>
      ) : (
        <CollapsibleList
          items={aiNotes}
          showAll={showAllAiNotes}
          onShowAll={() => setShowAllAiNotes(true)}
          renderItem={(n) => (
            <Link key={n.id} href={`/karte/team/notes/${n.id}`}>
              <Card className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {n.author_id !== userId &&
                      isNewSincePrevious(prevSeenAt, n.updated_at > n.created_at ? n.updated_at : n.created_at) && (
                        <NewBadge />
                      )}
                    <span className="font-mono text-[11px] font-bold text-ink-soft tracking-wide">
                      {formatDateLabel(n.created_at.slice(0, 10))}
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-orange/12 text-orange text-[9.5px] font-bold tracking-wide">
                      AI分析
                    </span>
                  </div>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
                </div>
                <ReactionSummary reactions={noteReactions.filter((r) => r.note_id === n.id)} />
              </Card>
            </Link>
          )}
        />
      )}

      <SectionLabel>スタッフコメント</SectionLabel>

      {notesLoading ? null : staffNotes.length === 0 ? (
        <Card>
          <div className="text-xs text-ink-soft">まだコメントがありません</div>
        </Card>
      ) : (
        staffNotes.map((n) =>
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
              className={canManagePlayers(role) ? "cursor-pointer" : ""}
              onClick={
                canManagePlayers(role) ? () => setExpandedNoteId(expandedNoteId === n.id ? null : n.id) : undefined
              }
            >
              <div className="flex items-center gap-1.5 font-mono text-[10.5px] font-bold text-ink-soft tracking-wide mb-1.5">
                {n.author_id !== userId &&
                  isNewSincePrevious(prevSeenAt, n.updated_at > n.created_at ? n.updated_at : n.created_at) && (
                    <NewBadge />
                  )}
                <span>
                  {formatDateLabel(n.created_at.slice(0, 10))}
                  {n.author_id && noteProfiles[n.author_id] ? ` ・ ${noteProfiles[n.author_id]}` : ""}
                </span>
              </div>
              <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{n.body}</div>
              <ReactionButtons
                reactions={noteReactions.filter((r) => r.note_id === n.id)}
                onToggle={(type) => toggleNoteReaction(n.id, type)}
                profiles={noteProfiles}
              />
              {canManagePlayers(role) && expandedNoteId === n.id && (
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

      {canManagePlayers(role) && (
        <>
          <SubmitButton onClick={() => setAddFeedbackOpen(true)} className="!mt-2.5">
            フィードバックを手動登録
          </SubmitButton>
          <AddFeedbackModal
            open={addFeedbackOpen}
            onClose={() => setAddFeedbackOpen(false)}
            onCreated={() => {
              setAddFeedbackOpen(false);
              toast("フィードバックを登録しました");
              loadNotes();
            }}
            insert={handleAddNote}
          />
        </>
      )}

      {role === "管理者" && hasAiAnalysisAccess(plan) && (
        <Modal open={analysisOpen} onClose={() => setAnalysisOpen(false)} title="分析用データ抽出〈全体分〉">
          <FieldLabel>年度</FieldLabel>
          <InlineSelect
            className="mb-3"
            value={String(analysisFiscalYear)}
            onChange={(v) => setAnalysisFiscalYear(Number(v))}
            options={FISCAL_YEAR_OPTIONS.map((y) => ({ value: String(y), label: `${y}年度` }))}
          />

          <FieldLabel>追加で重視してほしい点(任意)</FieldLabel>
          <textarea
            rows={3}
            className={inputClass()}
            value={analysisPrompt}
            onChange={(e) => setAnalysisPrompt(e.target.value)}
            placeholder="例: 新入部員の定着率を中心に見てほしい"
          />
          <div className="text-xs text-ink-soft mt-2.5">
            チームスタッツ・スポーツテスト・実施メニュー・練習参加状況のデータと分析の観点を整理したテキストがコピーされます。外部のAIチャットに貼り付けて利用できます
          </div>
          <SubmitButton onClick={handleCopyAnalysis} disabled={analysisLoading}>
            {analysisLoading ? "準備中…" : "この内容でコピーする"}
          </SubmitButton>
        </Modal>
      )}
    </PageShell>
  );
}
