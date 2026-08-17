"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { NumChip } from "@/components/ui/Pill";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { Modal } from "@/components/ui/Modal";
import { ChevronRightIcon } from "@/components/icons";
import { ReactionButtons } from "@/components/ReactionButtons";
import { canManagePlayers, canViewKarte } from "@/lib/permissions";
import { hasAiAnalysisAccess, hasKarteTabAccess } from "@/lib/plan";
import { usesDetailedBasketballStats, usesThreePointScoring } from "@/lib/sport";
import { StatCell } from "@/components/karte/StatCell";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { loadProfilesMap } from "@/lib/profiles";
import { markItemSeen } from "@/lib/itemBadges";
import {
  buildKarteAnalysisText,
  computeCustomSeasonAverages,
  computeSeasonAverages,
  DEFAULT_KARTE_ANALYSIS_PROMPT,
  GAME_COLUMNS,
  THREE_POINT_GAME_COLUMNS,
  SPORTS_TEST_RANKING_METRICS,
} from "@/lib/karteAggregate";
import {
  effectiveFiscalYear,
  fiscalYearOf,
  formatDateLabel,
  gradeLabel,
  playerFullName,
  sortPlayers,
  todayDateStr,
} from "@/lib/format";
import type {
  GamePlayerStatEntry,
  GamePlayerStatLine,
  Player,
  PlayerAnalysisNote,
  PlayerAnalysisNoteReaction,
  PlayerGrowthRecord,
  PracticeMenu,
  ReactionType,
  SportsTestRecord,
  TeamStatCategory,
} from "@/lib/database.types";
import { AddFeedbackModal } from "../../AddFeedbackModal";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());
const FISCAL_YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_FISCAL_YEAR - 4 + i);
const QUARTERS = [1, 2, 3, 4] as const;

// FG/FTは「成功数/試投数」の分数表示になるため、他の列より少し幅を広げる。
const colWidthClass = (key: (typeof GAME_COLUMNS)[number]["key"]) =>
  key === "fgPct" || key === "ftPct" || key === "twoPct" || key === "threePct"
    ? "w-[58px] min-w-[58px]"
    : "w-[50px] min-w-[50px]";

interface StatLineWithDate extends GamePlayerStatLine {
  game_matches: { opponent: string | null; schedules: { date: string; fiscal_year_override: number | null } | null } | null;
}

interface StatEntryWithDate extends GamePlayerStatEntry {
  game_matches: { opponent: string | null; schedules: { date: string; fiscal_year_override: number | null } | null } | null;
}

export default function KartePlayerPage() {
  const params = useParams<{ playerId: string }>();
  const router = useRouter();
  const { role, userId, plan, sport } = useSession();
  const toast = useToast();
  const columns = usesThreePointScoring(sport) ? [...GAME_COLUMNS, ...THREE_POINT_GAME_COLUMNS] : GAME_COLUMNS;

  const [player, setPlayer] = useState<Player | null>(null);
  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [statLines, setStatLines] = useState<StatLineWithDate[]>([]);
  const [statCategories, setStatCategories] = useState<TeamStatCategory[]>([]);
  const [statEntries, setStatEntries] = useState<StatEntryWithDate[]>([]);
  const [sportsTestRecords, setSportsTestRecords] = useState<SportsTestRecord[]>([]);
  const [growthRecords, setGrowthRecords] = useState<PlayerGrowthRecord[]>([]);
  const [attendedPractices, setAttendedPractices] = useState<{ id: string; date: string }[]>([]);
  const [attendedPracticeMenus, setAttendedPracticeMenus] = useState<PracticeMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisPrompt, setAnalysisPrompt] = useState(DEFAULT_KARTE_ANALYSIS_PROMPT);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<{ body: string; createdAt: string } | null>(null);

  const [analysisNotes, setAnalysisNotes] = useState<PlayerAnalysisNote[]>([]);
  const [noteReactions, setNoteReactions] = useState<PlayerAnalysisNoteReaction[]>([]);
  const [noteProfiles, setNoteProfiles] = useState<Record<string, string>>({});
  const [addFeedbackOpen, setAddFeedbackOpen] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteBody, setEditNoteBody] = useState("");
  const [savingNoteEdit, setSavingNoteEdit] = useState(false);
  const [deleteNoteConfirmId, setDeleteNoteConfirmId] = useState<string | null>(null);

  const editingNote = analysisNotes.find((n) => n.id === editingNoteId);
  useUnsavedChangesGuard(editingNote !== undefined && editNoteBody !== editingNote.body);

  useEffect(() => {
    if (!canViewKarte(role) || !hasKarteTabAccess(plan)) router.replace("/schedule");
  }, [role, plan, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [
      { data: p },
      { data: lines },
      { data: categories },
      { data: entries },
      { data: tests },
      { data: growth },
      { data: attendanceRows },
      { data: notes },
      profMap,
    ] = await Promise.all([
        supabase.from("players").select("*").eq("id", params.playerId).single(),
        supabase
          .from("game_player_stat_lines")
          .select("*, game_matches(opponent, schedules(date, fiscal_year_override))")
          .eq("player_id", params.playerId)
          .returns<StatLineWithDate[]>(),
        supabase.from("team_stat_categories").select("*").order("position", { ascending: true }),
        supabase
          .from("game_player_stat_entries")
          .select("*, game_matches(opponent, schedules(date, fiscal_year_override))")
          .eq("player_id", params.playerId)
          .returns<StatEntryWithDate[]>(),
        supabase
          .from("sports_test_records")
          .select("*")
          .eq("player_id", params.playerId)
          .eq("fiscal_year", fiscalYear),
        supabase
          .from("player_growth_records")
          .select("*")
          .eq("player_id", params.playerId)
          .order("measured_on", { ascending: false })
          .limit(6),
        supabase
          .from("attendances")
          .select("schedule_id")
          .eq("player_id", params.playerId)
          .in("status", ["出席", "遅刻早退"]),
        supabase
          .from("player_analysis_notes")
          .select("*")
          .eq("player_id", params.playerId)
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
    setStatLines(lines ?? []);
    setStatCategories(categories ?? []);
    setStatEntries(entries ?? []);
    setSportsTestRecords(tests ?? []);
    setGrowthRecords(growth ?? []);
    setAnalysisNotes(notes ?? []);
    setNoteProfiles(profMap);
    const noteIds = (notes ?? []).map((n) => n.id);
    if (noteIds.length > 0) {
      const { data: r } = await supabase.from("player_analysis_note_reactions").select("*").in("note_id", noteIds);
      setNoteReactions(r ?? []);
    } else {
      setNoteReactions([]);
    }

    // 出席・遅刻早退した予定(見学・欠席は除く)のうち練習だけに絞り、その練習に紐づく実施メニューを集計する。
    // 「このワークアウトをこれだけこなした」を、出欠に基づいて把握できるようにするため。
    const attendedScheduleIds = Array.from(new Set((attendanceRows ?? []).map((a) => a.schedule_id)));
    let practices: { id: string; date: string }[] = [];
    let menus: PracticeMenu[] = [];
    if (attendedScheduleIds.length > 0) {
      const { data: schedules } = await supabase
        .from("schedules")
        .select("id, date")
        .in("id", attendedScheduleIds)
        .eq("type", "practice");
      practices = schedules ?? [];
      const practiceIds = practices.map((s) => s.id);
      if (practiceIds.length > 0) {
        const { data: m } = await supabase.from("practice_menus").select("*").in("schedule_id", practiceIds);
        menus = m ?? [];
      }
    }
    setAttendedPractices(practices);
    setAttendedPracticeMenus(menus);

    setLoading(false);
  }, [params.playerId, fiscalYear]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    markItemSeen(userId, "player_analysis", params.playerId);
  }, [userId, params.playerId]);

  const seasonLines = statLines
    .filter((l) => {
      const date = l.game_matches?.schedules?.date;
      if (!date) return false;
      return effectiveFiscalYear(date, l.game_matches?.schedules?.fiscal_year_override ?? null) === fiscalYear;
    })
    .sort((a, b) => (a.game_matches?.schedules?.date ?? "").localeCompare(b.game_matches?.schedules?.date ?? ""));
  const seasonAverages = computeSeasonAverages(seasonLines);
  const gameRows = seasonLines.map((l) => ({
    label: `${formatDateLabel(l.game_matches?.schedules?.date ?? "")} vs ${l.game_matches?.opponent ?? "-"}`,
    averages: computeSeasonAverages([l]),
  }));

  // バスケットボール・ミニバスケットボール以外の競技向け(チームが自由に定義したカスタム項目)。
  const seasonEntries = statEntries.filter((e) => {
    const date = e.game_matches?.schedules?.date;
    if (!date) return false;
    return effectiveFiscalYear(date, e.game_matches?.schedules?.fiscal_year_override ?? null) === fiscalYear;
  });
  const customSeasonAverages = computeCustomSeasonAverages(seasonEntries, statCategories);
  const customGameRows = Array.from(new Set(seasonEntries.map((e) => e.match_id)))
    .map((matchId) => {
      const matchEntries = seasonEntries.filter((e) => e.match_id === matchId);
      const first = matchEntries[0];
      return {
        date: first.game_matches?.schedules?.date ?? "",
        label: `${formatDateLabel(first.game_matches?.schedules?.date ?? "")} vs ${first.game_matches?.opponent ?? "-"}`,
        averages: computeCustomSeasonAverages(matchEntries, statCategories),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const attendedPracticesInYear = attendedPractices.filter((s) => fiscalYearOf(s.date) === fiscalYear);
  const attendedScheduleIdsInYear = new Set(attendedPracticesInYear.map((s) => s.id));
  const workoutTallyMap = new Map<string, number>();
  attendedPracticeMenus
    .filter((m) => attendedScheduleIdsInYear.has(m.schedule_id))
    .forEach((m) => {
      const theme = (m.theme ?? "").trim();
      if (!theme) return;
      workoutTallyMap.set(theme, (workoutTallyMap.get(theme) ?? 0) + 1);
    });
  const workoutTallies = Array.from(workoutTallyMap.entries())
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count);

  async function loadNoteReactions() {
    const noteIds = analysisNotes.map((n) => n.id);
    if (noteIds.length === 0) return;
    const supabase = createClient();
    const { data } = await supabase.from("player_analysis_note_reactions").select("*").in("note_id", noteIds);
    setNoteReactions(data ?? []);
  }

  async function toggleNoteReaction(noteId: string, type: ReactionType) {
    if (!player) return;
    const supabase = createClient();
    const existing = noteReactions.find(
      (r) => r.note_id === noteId && r.reaction_type === type && r.profile_id === userId,
    );
    if (existing) {
      const { error } = await supabase.from("player_analysis_note_reactions").delete().eq("id", existing.id);
      if (error) {
        toast(`取り消しに失敗しました: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("player_analysis_note_reactions").insert({
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
    loadNoteReactions();
  }

  async function handleCopyAnalysis() {
    if (!player) return;
    const text = buildKarteAnalysisText({
      promptText: analysisPrompt,
      player,
      fiscalYear,
      seasonAverages,
      gameRows,
      sportsTestRecords,
      growthRecords,
      workoutTallies,
      attendedPracticeCount: attendedPracticesInYear.length,
    });
    try {
      await navigator.clipboard.writeText(text);
      toast("分析用テキストをコピーしました");
      setAnalysisOpen(false);
    } catch {
      toast("コピーに失敗しました");
    }
  }

  useEffect(() => {
    if (!analysisOpen || !player || !hasAiAnalysisAccess(plan)) return;
    setAiResult(null);
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("player_ai_analysis")
        .select("body, created_at")
        .eq("player_id", player.id)
        .eq("fiscal_year", fiscalYear)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setAiResult({ body: data.body, createdAt: data.created_at });
    })();
  }, [analysisOpen, player, fiscalYear, plan]);

  async function handleGenerateAiAnalysis() {
    if (!player) return;
    const text = buildKarteAnalysisText({
      promptText: analysisPrompt,
      player,
      fiscalYear,
      seasonAverages,
      gameRows,
      sportsTestRecords,
      growthRecords,
      workoutTallies,
      attendedPracticeCount: attendedPracticesInYear.length,
    });
    setAiGenerating(true);
    try {
      const res = await fetch("/api/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "player", playerId: player.id, fiscalYear, dataText: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "AI分析の生成に失敗しました");
        return;
      }
      setAiResult({ body: data.body, createdAt: new Date().toISOString() });
    } catch {
      toast("AI分析の生成に失敗しました");
    } finally {
      setAiGenerating(false);
    }
  }

  async function handleAddNote(body: string) {
    if (!player) return { error: "選手情報を読み込めませんでした" };
    const supabase = createClient();
    const { error } = await supabase.from("player_analysis_notes").insert({
      team_id: player.team_id,
      player_id: player.id,
      author_id: userId,
      body,
    });
    return { error: error?.message ?? null };
  }

  function startEditNote(n: PlayerAnalysisNote) {
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
      .from("player_analysis_notes")
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
    const { error } = await supabase.from("player_analysis_notes").delete().eq("id", noteId);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    toast("メモを削除しました");
    setExpandedNoteId(null);
    load();
  }

  if (loading) {
    return (
      <PageShell header={<AppHeader title="カルテ" variant="detail" backHref="/karte/players" accessBadge="coach" />}>
        <EmptyState>読み込み中…</EmptyState>
      </PageShell>
    );
  }

  if (!player) {
    return (
      <PageShell header={<AppHeader title="カルテ" variant="detail" backHref="/karte/players" accessBadge="coach" />}>
        <EmptyState>選手が見つかりません</EmptyState>
      </PageShell>
    );
  }

  return (
    <PageShell header={<AppHeader title={`${playerFullName(player)} / カルテ`} variant="detail" backHref="/karte/players" accessBadge="coach" />}>
      <div className="flex items-center justify-between mb-3">
        {prevId ? (
          <Link
            href={`/karte/players/${prevId}`}
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
            href={`/karte/players/${nextId}`}
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

      <Card>
        <div className="flex items-center gap-2.5">
          <NumChip num={player.number ?? "-"} />
          <div>
            <div className="font-bold text-[13.5px]">{playerFullName(player)}</div>
            <div className="text-[11px] text-ink-soft mt-0.5">
              {gradeLabel(player.grade)}・{player.positions.join("/")}
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <FieldLabel>年度</FieldLabel>
          <div className="relative inline-block">
            <select
              className="appearance-none bg-white border border-line rounded-[10px] pl-3 pr-8 py-1.5 text-[12.5px] font-bold text-ink"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
            >
              {FISCAL_YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}年度
                </option>
              ))}
            </select>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
          </div>
        </div>
        {role === "管理者" && (
          <button
            type="button"
            onClick={() => setAnalysisOpen(true)}
            className="flex-none px-3 py-1.5 rounded-[10px] border border-orange text-[11px] font-bold text-orange bg-orange/8"
          >
            分析用抽出
          </button>
        )}
      </div>

      {role === "管理者" && (
        <Modal open={analysisOpen} onClose={() => setAnalysisOpen(false)} title="分析用抽出">
          <FieldLabel>AIへの指示文</FieldLabel>
          <textarea
            rows={3}
            className={inputClass()}
            value={analysisPrompt}
            onChange={(e) => setAnalysisPrompt(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setAnalysisPrompt(DEFAULT_KARTE_ANALYSIS_PROMPT)}
            className="text-[11px] font-bold text-orange mt-1.5"
          >
            デフォルトの文言に戻す
          </button>
          <div className="text-xs text-ink-soft mt-2.5">
            この指示文に続けて、選手のスタッツ・スポーツテスト・身長体重のデータがコピーされます
          </div>
          <SubmitButton onClick={handleCopyAnalysis}>この内容でコピーする</SubmitButton>

          {hasAiAnalysisAccess(plan) && (
            <>
              <SubmitButton onClick={handleGenerateAiAnalysis} disabled={aiGenerating}>
                {aiGenerating ? "生成中…" : "AI分析を生成する"}
              </SubmitButton>
              {aiResult && (
                <div className="mt-3 bg-paper border border-line rounded-[10px] p-3">
                  <div className="text-[10.5px] text-ink-soft font-bold mb-1.5">
                    {formatDateLabel(aiResult.createdAt.slice(0, 10))}生成
                  </div>
                  <div className="text-[12.5px] leading-relaxed whitespace-pre-wrap max-h-[240px] overflow-y-auto">
                    {aiResult.body}
                  </div>
                </div>
              )}
            </>
          )}
        </Modal>
      )}

      <SectionLabel>試合スタッツ(試合ごと)</SectionLabel>
      {usesDetailedBasketballStats(sport) ? (
        gameRows.length === 0 ? (
          <Card>
            <EmptyState>この年度の出場記録がありません</EmptyState>
          </Card>
        ) : (
          <div className="bg-white border border-line rounded-2xl overflow-auto max-h-[65vh] mb-2.5">
            <table className="border-collapse text-[11.5px] w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap">
                    試合
                  </th>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className={`sticky top-0 h-9 bg-paper z-20 ${colWidthClass(c.key)} px-1 border-b border-line font-bold whitespace-nowrap text-center text-ink-soft`}
                    >
                      {c.abbr}
                    </th>
                  ))}
                </tr>
                <tr className="bg-paper">
                  <th className="sticky left-0 top-9 h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap font-bold">
                    シーズン平均
                  </th>
                  {columns.map((c) => {
                    const v = seasonAverages[c.key] as number | null;
                    return (
                      <th
                        key={c.key}
                        className={`sticky top-9 h-9 bg-paper z-20 ${colWidthClass(c.key)} px-1 text-center font-mono font-bold border-b border-line whitespace-nowrap ${
                          c.key === "eff" && v !== null && v < 0 ? "text-danger" : ""
                        }`}
                      >
                        <StatCell statKey={c.key} averages={seasonAverages} />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {gameRows.map((row, i) => (
                  <tr key={i}>
                    <td className="sticky left-0 bg-white z-10 px-2.5 py-2 whitespace-nowrap border-b border-line last:border-b-0">
                      {row.label}
                    </td>
                    {columns.map((c) => {
                      const v = row.averages[c.key] as number | null;
                      return (
                        <td
                          key={c.key}
                          className={`${colWidthClass(c.key)} px-1 py-2 text-center font-mono border-b border-line last:border-b-0 whitespace-nowrap ${
                            c.key === "eff" && v !== null && v < 0 ? "text-danger" : ""
                          }`}
                        >
                          <StatCell statKey={c.key} averages={row.averages} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : statCategories.length === 0 ? (
        <Card>
          <EmptyState>まだスタッツ項目がありません</EmptyState>
        </Card>
      ) : customGameRows.length === 0 ? (
        <Card>
          <EmptyState>この年度の出場記録がありません</EmptyState>
        </Card>
      ) : (
        <div className="bg-white border border-line rounded-2xl overflow-auto max-h-[65vh] mb-2.5">
          <table className="border-collapse text-[11.5px] w-full">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap">
                  試合
                </th>
                {statCategories.map((c) => (
                  <th
                    key={c.id}
                    className="sticky top-0 h-9 bg-paper z-20 w-[58px] min-w-[58px] px-1 border-b border-line font-bold whitespace-nowrap text-center text-ink-soft"
                  >
                    {c.name}
                  </th>
                ))}
              </tr>
              <tr className="bg-paper">
                <th className="sticky left-0 top-9 h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap font-bold">
                  シーズン平均
                </th>
                {statCategories.map((c) => (
                  <th
                    key={c.id}
                    className="sticky top-9 h-9 bg-paper z-20 w-[58px] min-w-[58px] px-1 text-center font-mono font-bold border-b border-line whitespace-nowrap"
                  >
                    {customSeasonAverages.averages[c.id] ?? 0}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customGameRows.map((row, i) => (
                <tr key={i}>
                  <td className="sticky left-0 bg-white z-10 px-2.5 py-2 whitespace-nowrap border-b border-line last:border-b-0">
                    {row.label}
                  </td>
                  {statCategories.map((c) => (
                    <td
                      key={c.id}
                      className="w-[58px] min-w-[58px] px-1 py-2 text-center font-mono border-b border-line last:border-b-0 whitespace-nowrap"
                    >
                      {row.averages.totals[c.id] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SectionLabel>スポーツテスト(四半期ごと)</SectionLabel>
      <div className="bg-white border border-line rounded-2xl overflow-auto max-h-[65vh] mb-2.5">
        <table className="border-collapse text-[11.5px] w-full">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 h-11 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap">
                四半期
              </th>
              {SPORTS_TEST_RANKING_METRICS.map((m) => (
                <th
                  key={m.value}
                  className="sticky top-0 h-11 bg-paper z-20 w-[54px] min-w-[54px] px-1 border-b border-line font-bold text-center leading-tight text-ink-soft"
                >
                  <div className="whitespace-nowrap">{m.abbrLines[0]}</div>
                  <div className="whitespace-nowrap">{m.abbrLines[1]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {QUARTERS.map((q) => {
              const record = sportsTestRecords.find((r) => r.quarter === q);
              return (
                <tr key={q}>
                  <td className="sticky left-0 bg-white z-10 px-2.5 py-2 whitespace-nowrap border-b border-line last:border-b-0 font-bold">
                    Q{q}
                  </td>
                  {SPORTS_TEST_RANKING_METRICS.map((m) => {
                    const v = record && !record.not_conducted ? m.extract(record) : null;
                    return (
                      <td
                        key={m.value}
                        className="w-[54px] min-w-[54px] px-1 py-2 text-center font-mono border-b border-line last:border-b-0"
                      >
                        {v === null ? "-" : v}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Link
        href={`/players/${player.id}/sports-test`}
        className="block mb-2.5 text-center py-2 rounded-[10px] font-bold text-[12px] border border-line text-ink-soft bg-white"
      >
        スポーツテストを入力・編集する
      </Link>

      <SectionLabel>身長・体重(週次)</SectionLabel>
      <Card>
        {growthRecords.length === 0 ? (
          <EmptyState>記録がありません</EmptyState>
        ) : (
          <div className="text-[13px]">
            {growthRecords.map((g) => (
              <div key={g.id} className="flex items-center justify-between py-1 border-b border-line last:border-b-0">
                <span className="text-ink-soft text-[11px]">{formatDateLabel(g.measured_on)}</span>
                <span className="font-mono font-bold">
                  {g.height_cm ?? "-"}cm / {g.weight_kg ?? "-"}kg
                </span>
              </div>
            ))}
          </div>
        )}
        <Link
          href={`/players/${player.id}/growth`}
          className="block mt-3 text-center py-2 rounded-[10px] font-bold text-[12px] border border-line text-ink-soft bg-paper"
        >
          記録を入力・編集する
        </Link>
      </Card>

      {canManagePlayers(role) && (
        <>
          <SectionLabel>選手メモ</SectionLabel>
          <Link href={`/players/${player.id}/notes`}>
            <Card className="cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="font-bold text-[13.5px]">メモを見る・編集する</div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
              </div>
            </Card>
          </Link>
        </>
      )}

      <SectionLabel>選手分析フィードバック</SectionLabel>
      {analysisNotes.length === 0 ? (
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
                profiles={noteProfiles}
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
              load();
            }}
            insert={handleAddNote}
          />
        </>
      )}
    </PageShell>
  );
}
