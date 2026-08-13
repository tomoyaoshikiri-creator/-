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
import { canViewKarte } from "@/lib/permissions";
import { StatCell } from "@/components/karte/StatCell";
import {
  buildKarteAnalysisText,
  computeSeasonAverages,
  DEFAULT_KARTE_ANALYSIS_PROMPT,
  GAME_COLUMNS,
  SPORTS_TEST_RANKING_METRICS,
} from "@/lib/karteAggregate";
import { effectiveFiscalYear, fiscalYearOf, formatDateLabel, gradeLabel, playerFullName, todayDateStr } from "@/lib/format";
import type { GamePlayerStatLine, Player, PlayerGrowthRecord, SportsTestRecord } from "@/lib/database.types";

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
  const { role } = useSession();
  const toast = useToast();

  const [player, setPlayer] = useState<Player | null>(null);
  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [statLines, setStatLines] = useState<StatLineWithDate[]>([]);
  const [sportsTestRecords, setSportsTestRecords] = useState<SportsTestRecord[]>([]);
  const [growthRecords, setGrowthRecords] = useState<PlayerGrowthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisPrompt, setAnalysisPrompt] = useState(DEFAULT_KARTE_ANALYSIS_PROMPT);

  useEffect(() => {
    if (!canViewKarte(role)) router.replace("/schedule");
  }, [role, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: p }, { data: lines }, { data: tests }, { data: growth }] = await Promise.all([
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
    ]);
    setPlayer(p ?? null);
    setStatLines(lines ?? []);
    setSportsTestRecords(tests ?? []);
    setGrowthRecords(growth ?? []);
    setLoading(false);
  }, [params.playerId, fiscalYear]);

  useEffect(() => {
    load();
  }, [load]);

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
    });
    try {
      await navigator.clipboard.writeText(text);
      toast("分析用テキストをコピーしました");
      setAnalysisOpen(false);
    } catch {
      toast("コピーに失敗しました");
    }
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

      <div className="mt-3">
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
        <>
          <button
            type="button"
            onClick={() => setAnalysisOpen(true)}
            className="w-full mb-3 px-3 py-2 rounded-[10px] border border-orange text-[12.5px] font-bold text-orange bg-orange/8"
          >
            分析用出力(AIに貼り付け用にコピー)
          </button>
          <Modal open={analysisOpen} onClose={() => setAnalysisOpen(false)} title="分析用出力">
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
        </>
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
    </PageShell>
  );
}
