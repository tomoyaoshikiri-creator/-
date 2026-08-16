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
import { ChevronRightIcon } from "@/components/icons";
import { ReactionButtons } from "@/components/ReactionButtons";
import { canManagePlayers, canViewKarte } from "@/lib/permissions";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { hasCachedValue, useCachedState } from "@/lib/pageCache";
import { loadProfilesMap } from "@/lib/profiles";
import { markItemSeen } from "@/lib/itemBadges";
import {
  buildTeamKarteAnalysisText,
  computeSeasonAverages,
  computeSportsTestTeamAverages,
  computeTeamAverages,
  DEFAULT_TEAM_KARTE_ANALYSIS_PROMPT,
  type SeasonStatAverages,
  type SportsTestMetric,
} from "@/lib/karteAggregate";
import { effectiveFiscalYear, fiscalYearOf, formatDateLabel, todayDateStr } from "@/lib/format";
import type {
  GamePlayerStatLine,
  PracticeMenu,
  ReactionType,
  TeamAnalysisNote,
  TeamAnalysisNoteReaction,
} from "@/lib/database.types";
import { AddFeedbackModal } from "../AddFeedbackModal";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());
const FISCAL_YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_FISCAL_YEAR - 4 + i);
const QUARTERS = [1, 2, 3, 4] as const;

interface StatLineWithDate extends GamePlayerStatLine {
  game_matches: { schedules: { date: string; fiscal_year_override: number | null } | null } | null;
}

export default function KarteTeamPage() {
  const router = useRouter();
  const { role, userId, teamId } = useSession();
  const toast = useToast();

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisFiscalYear, setAnalysisFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [analysisPrompt, setAnalysisPrompt] = useState(DEFAULT_TEAM_KARTE_ANALYSIS_PROMPT);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [teamAverages, setTeamAverages] = useState<SeasonStatAverages | null>(null);
  const [sportsTestQuarterAverages, setSportsTestQuarterAverages] = useState<
    { quarter: number; averages: Partial<Record<SportsTestMetric, number | null>> }[]
  >([]);
  const [workoutTallies, setWorkoutTallies] = useState<{ theme: string; count: number }[]>([]);
  const [practicesHeld, setPracticesHeld] = useState(0);
  const [averageAttendanceRate, setAverageAttendanceRate] = useState<number | null>(null);

  const [analysisNotes, setAnalysisNotes] = useCachedState<TeamAnalysisNote[]>("karteTeam:notes", []);
  const [noteReactions, setNoteReactions] = useCachedState<TeamAnalysisNoteReaction[]>(
    "karteTeam:noteReactions",
    [],
  );
  const [noteProfiles, setNoteProfiles] = useCachedState<Record<string, string>>("karteTeam:noteProfiles", {});
  const [notesLoading, setNotesLoading] = useState(() => !hasCachedValue("karteTeam:notes"));
  const [addFeedbackOpen, setAddFeedbackOpen] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteBody, setEditNoteBody] = useState("");
  const [savingNoteEdit, setSavingNoteEdit] = useState(false);
  const [deleteNoteConfirmId, setDeleteNoteConfirmId] = useState<string | null>(null);

  const editingNote = analysisNotes.find((n) => n.id === editingNoteId);
  useUnsavedChangesGuard(editingNote !== undefined && editNoteBody !== editingNote.body);

  useEffect(() => {
    if (!canViewKarte(role)) router.replace("/schedule");
  }, [role, router]);

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
    }
    loadNoteReactions();
  }

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    markItemSeen(userId, "team_analysis", teamId);
  }, [userId, teamId]);

  useEffect(() => {
    if (!analysisOpen) return;
    (async () => {
      setAnalysisLoading(true);
      const supabase = createClient();

      const [{ data: allPlayers }, { data: statLines }, { data: sportsTests }, { data: practiceSchedules }] = await Promise.all([
        supabase.from("players").select("*"),
        supabase
          .from("game_player_stat_lines")
          .select("*, game_matches(schedules(date, fiscal_year_override))")
          .returns<StatLineWithDate[]>(),
        supabase.from("sports_test_records").select("*").eq("fiscal_year", analysisFiscalYear).eq("not_conducted", false),
        supabase.from("schedules").select("id, date").eq("type", "practice").lte("date", todayDateStr()),
      ]);

      const activePlayers = (allPlayers ?? []).filter((p) => p.status !== "OB・OG");
      setPlayerCount(activePlayers.length);

      const linesForYear = (statLines ?? []).filter((l) => {
        const date = l.game_matches?.schedules?.date;
        if (!date) return false;
        return effectiveFiscalYear(date, l.game_matches?.schedules?.fiscal_year_override ?? null) === analysisFiscalYear;
      });
      // 「スタッツ」ページ(karte/team/game)と同じ集計対象にする:
      // 在籍選手に加えて、この年度に出場記録があるOB・OGも含める。
      const gamePlayers = (allPlayers ?? []).filter(
        (p) => p.status !== "OB・OG" || linesForYear.some((l) => l.player_id === p.id),
      );
      const playerAverages = gamePlayers.map((p) => computeSeasonAverages(linesForYear.filter((l) => l.player_id === p.id)));
      setTeamAverages(computeTeamAverages(playerAverages, linesForYear));

      setSportsTestQuarterAverages(
        QUARTERS.map((q) => ({ quarter: q, records: (sportsTests ?? []).filter((r) => r.quarter === q) }))
          .filter((qa) => qa.records.length > 0)
          .map((qa) => ({ quarter: qa.quarter, averages: computeSportsTestTeamAverages(qa.records) })),
      );

      const yearPractices = (practiceSchedules ?? []).filter((s) => fiscalYearOf(s.date) === analysisFiscalYear);
      const practiceIds = yearPractices.map((s) => s.id);
      setPracticesHeld(yearPractices.length);

      let menus: PracticeMenu[] = [];
      let attendanceRows: { schedule_id: string; player_id: string | null }[] = [];
      if (practiceIds.length > 0) {
        const [{ data: m }, { data: a }] = await Promise.all([
          supabase.from("practice_menus").select("*").in("schedule_id", practiceIds),
          supabase
            .from("attendances")
            .select("schedule_id, player_id")
            .in("schedule_id", practiceIds)
            .in("status", ["出席", "遅刻早退"]),
        ]);
        menus = m ?? [];
        attendanceRows = a ?? [];
      }

      const tallyMap = new Map<string, number>();
      menus.forEach((m) => {
        const theme = (m.theme ?? "").trim();
        if (!theme) return;
        tallyMap.set(theme, (tallyMap.get(theme) ?? 0) + 1);
      });
      setWorkoutTallies(
        Array.from(tallyMap.entries())
          .map(([theme, count]) => ({ theme, count }))
          .sort((a, b) => b.count - a.count),
      );

      if (yearPractices.length > 0 && activePlayers.length > 0) {
        const countByPlayer = new Map<string, number>();
        attendanceRows.forEach((a) => {
          if (!a.player_id) return;
          countByPlayer.set(a.player_id, (countByPlayer.get(a.player_id) ?? 0) + 1);
        });
        const rates = activePlayers.map((p) => (countByPlayer.get(p.id) ?? 0) / yearPractices.length);
        setAverageAttendanceRate(Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 1000) / 10);
      } else {
        setAverageAttendanceRate(null);
      }

      setAnalysisLoading(false);
    })();
  }, [analysisOpen, analysisFiscalYear]);

  async function handleCopyAnalysis() {
    if (!teamAverages) return;
    const text = buildTeamKarteAnalysisText({
      promptText: analysisPrompt,
      fiscalYear: analysisFiscalYear,
      playerCount,
      teamAverages,
      sportsTestQuarterAverages,
      workoutTallies,
      practicesHeld,
      averageAttendanceRate,
    });
    try {
      await navigator.clipboard.writeText(text);
      toast("分析用テキストをコピーしました");
      setAnalysisOpen(false);
    } catch {
      toast("コピーに失敗しました");
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
    <PageShell header={<AppHeader title="チームカルテ" variant="detail" backHref="/karte" accessBadge="coach" />}>
      <Link href="/game">
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px]">試合記録</div>
              <div className="text-[11.5px] text-ink-soft mt-1">試合結果・記録を見る</div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </Card>
      </Link>

      <Link href="/karte/team/game">
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px]">スタッツ</div>
              <div className="text-[11.5px] text-ink-soft mt-1">選手ごとの試合スタッツ</div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </Card>
      </Link>

      <Link href="/karte/team/sports-test">
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px]">スポーツテスト</div>
              <div className="text-[11.5px] text-ink-soft mt-1">選手ごとのスポーツテスト結果</div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </Card>
      </Link>

      <Link href="/karte/team/workout">
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px]">ワークアウト</div>
              <div className="text-[11.5px] text-ink-soft mt-1">いつどんな練習をしたかの履歴</div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </Card>
      </Link>

      {role === "管理者" && (
        <button
          type="button"
          onClick={() => setAnalysisOpen(true)}
          className="w-full text-left bg-orange/8 border border-orange rounded-2xl px-4 py-[7px] mb-2.5 flex items-center justify-between"
        >
          <div className="font-bold text-[12.5px] text-orange">分析用データ抽出〈全体分〉</div>
          <ChevronRightIcon className="w-3.5 h-3.5 text-orange flex-shrink-0" />
        </button>
      )}

      {role === "管理者" && (
        <Modal open={analysisOpen} onClose={() => setAnalysisOpen(false)} title="分析用データ抽出〈全体分〉">
          <FieldLabel>年度</FieldLabel>
          <div className="relative inline-block mb-3">
            <select
              className="appearance-none bg-white border border-line rounded-[10px] pl-3 pr-8 py-1.5 text-[12.5px] font-bold text-ink"
              value={analysisFiscalYear}
              onChange={(e) => setAnalysisFiscalYear(Number(e.target.value))}
            >
              {FISCAL_YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}年度
                </option>
              ))}
            </select>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
          </div>

          <FieldLabel>AIへの指示文</FieldLabel>
          <textarea
            rows={3}
            className={inputClass()}
            value={analysisPrompt}
            onChange={(e) => setAnalysisPrompt(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setAnalysisPrompt(DEFAULT_TEAM_KARTE_ANALYSIS_PROMPT)}
            className="text-[11px] font-bold text-orange mt-1.5"
          >
            デフォルトの文言に戻す
          </button>
          <div className="text-xs text-ink-soft mt-2.5">
            この指示文に続けて、チーム平均スタッツ・スポーツテスト・実施メニュー・練習参加状況のデータがコピーされます
          </div>
          <SubmitButton onClick={handleCopyAnalysis} disabled={analysisLoading}>
            {analysisLoading ? "読み込み中…" : "この内容でコピーする"}
          </SubmitButton>
        </Modal>
      )}

      <SectionLabel>チーム分析フィードバック</SectionLabel>
      {notesLoading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : analysisNotes.length === 0 ? (
        <Card>
          <div className="text-xs text-ink-soft">まだコメントがありません</div>
        </Card>
      ) : (
        analysisNotes.map((n) =>
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
              className={canManagePlayers(role) ? "cursor-pointer" : ""}
              onClick={canManagePlayers(role) ? () => setExpandedNoteId(expandedNoteId === n.id ? null : n.id) : undefined}
            >
              <div className="font-mono text-[10.5px] font-bold text-ink-soft tracking-wide mb-1.5">
                {formatDateLabel(n.created_at.slice(0, 10))}
                {n.author_id && noteProfiles[n.author_id] ? ` ・ ${noteProfiles[n.author_id]}` : ""}
              </div>
              <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{n.body}</div>
              <ReactionButtons
                reactions={noteReactions.filter((r) => r.note_id === n.id)}
                onToggle={(type) => toggleNoteReaction(n.id, type)}
              />
              {canManagePlayers(role) && expandedNoteId === n.id && (
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

      {canManagePlayers(role) && (
        <>
          <SubmitButton onClick={() => setAddFeedbackOpen(true)}>フィードバックを登録</SubmitButton>
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
    </PageShell>
  );
}
