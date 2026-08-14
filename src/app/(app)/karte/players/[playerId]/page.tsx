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
import { StatCell } from "@/components/karte/StatCell";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { loadProfilesMap } from "@/lib/profiles";
import { markTabSeen } from "@/lib/tabBadges";
import {
  buildKarteAnalysisText,
  computeSeasonAverages,
  DEFAULT_KARTE_ANALYSIS_PROMPT,
  GAME_COLUMNS,
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
  GamePlayerStatLine,
  Player,
  PlayerAnalysisNote,
  PlayerAnalysisNoteReaction,
  PlayerGrowthRecord,
  PracticeMenu,
  ReactionType,
  SportsTestRecord,
} from "@/lib/database.types";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());
const FISCAL_YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_FISCAL_YEAR - 4 + i);
const QUARTERS = [1, 2, 3, 4] as const;

// FG/FTは「成功数/試投数」の分数表示になるため、他の列より少し幅を広げる。
const colWidthClass = (key: (typeof GAME_COLUMNS)[number]["key"]) =>
  key === "fgPct" || key === "ftPct" ? "w-[58px] min-w-[58px]" : "w-[50px] min-w-[50px]";

interface StatLineWithDate extends GamePlayerStatLine {
  game_matches: { opponent: string | null; schedules: { date: string; fiscal_year_override: number | null } | null } | null;
}

export default function KartePlayerPage() {
  const params = useParams<{ playerId: string }>();
  const router = useRouter();
  const { role, userId } = useSession();
  const toast = useToast();

  const [player, setPlayer] = useState<Player | null>(null);
  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [statLines, setStatLines] = useState<StatLineWithDate[]>([]);
  const [sportsTestRecords, setSportsTestRecords] = useState<SportsTestRecord[]>([]);
  const [growthRecords, setGrowthRecords] = useState<PlayerGrowthRecord[]>([]);
  const [attendedPractices, setAttendedPractices] = useState<{ id: string; date: string }[]>([]);
  const [attendedPracticeMenus, setAttendedPracticeMenus] = useState<PracticeMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisPrompt, setAnalysisPrompt] = useState(DEFAULT_KARTE_ANALYSIS_PROMPT);

  const [analysisNotes, setAnalysisNotes] = useState<PlayerAnalysisNote[]>([]);
  const [noteReactions, setNoteReactions] = useState<PlayerAnalysisNoteReaction[]>([]);
  const [noteProfiles, setNoteProfiles] = useState<Record<string, string>>({});
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteBody, setEditNoteBody] = useState("");
  const [savingNoteEdit, setSavingNoteEdit] = useState(false);
  const [deleteNoteConfirmId, setDeleteNoteConfirmId] = useState<string | null>(null);

  useUnsavedChangesGuard(noteBody.trim() !== "");
  const editingNote = analysisNotes.find((n) => n.id === editingNoteId);
  useUnsavedChangesGuard(editingNote !== undefined && editNoteBody !== editingNote.body);

  useEffect(() => {
    if (!canViewKarte(role)) router.replace("/schedule");
  }, [role, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: p }, { data: lines }, { data: tests }, { data: growth }, { data: attendanceRows }, { data: notes }, profMap] =
      await Promise.all([
        supabase.from("players").select("*").eq("id", params.playerId).single(),
        supabase
          .from("game_player_stat_lines")
          .select("*, game_matches(opponent, schedules(date, fiscal_year_override))")
          .eq("player_id", params.playerId)
          .returns<StatLineWithDate[]>(),
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
        supabase.from("attendances").select("schedule_id").eq("player_id", params.playerId).eq("status", "出席"),
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

    // 出席(status=出席)した予定のうち練習だけに絞り、その練習に紐づく実施メニューを集計する。
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
    markTabSeen(userId, "analysis_notes");
  }, [userId]);

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

  async function handleAddNote() {
    if (!player) return;
    if (!noteBody.trim()) {
      toast("メモを入力してください");
      return;
    }
    setSavingNote(true);
    const supabase = createClient();
    const { error } = await supabase.from("player_analysis_notes").insert({
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
        </Modal>
      )}

      <SectionLabel>試合スタッツ(試合ごと)</SectionLabel>
      {gameRows.length === 0 ? (
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
                {GAME_COLUMNS.map((c) => (
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
                {GAME_COLUMNS.map((c) => {
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
                  {GAME_COLUMNS.map((c) => {
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
          <div className="text-xs text-ink-soft">まだメモがありません</div>
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
                    className="flex-1 text-center py-1.5 rounded-[8px] font-bold text-[11px] border bg-white"
                    style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                  >
                    {deleteNoteConfirmId === n.id ? "もう一度タップで削除確定" : "削除"}
                  </button>
                </div>
              )}
            </Card>
          ),
        )
      )}

      {canManagePlayers(role) && (
        <Card>
          <FieldLabel>メモを追加</FieldLabel>
          <textarea
            rows={3}
            className={inputClass()}
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="例:分析してもらった内容を貼り付ける"
          />
          <SubmitButton onClick={handleAddNote} disabled={savingNote}>
            {savingNote ? "登録中…" : "メモを登録する"}
          </SubmitButton>
        </Card>
      )}
    </PageShell>
  );
}
