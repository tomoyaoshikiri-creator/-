"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState } from "@/components/ui/Card";
import { NumChip } from "@/components/ui/Pill";
import { SegButton, FieldLabel } from "@/components/ui/SegButton";
import { ChevronRightIcon } from "@/components/icons";
import { canViewKarte } from "@/lib/permissions";
import {
  computeSeasonAverages,
  RANKING_METRICS,
  SPORTS_TEST_RANKING_METRICS,
  type RankingMetric,
  type SportsTestMetric,
} from "@/lib/karteAggregate";
import { effectiveFiscalYear, fiscalYearOf, gradeLabel, playerFullName, sortPlayers, todayDateStr } from "@/lib/format";
import type { GamePlayerStatLine, Player, SportsTestRecord } from "@/lib/database.types";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());
const FISCAL_YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_FISCAL_YEAR - 4 + i);
const QUARTERS = [1, 2, 3, 4] as const;

interface StatLineWithDate extends GamePlayerStatLine {
  game_matches: { schedules: { date: string; fiscal_year_override: number | null } | null } | null;
}

export default function KarteRankingPage() {
  const router = useRouter();
  const { role } = useSession();
  const [category, setCategory] = useState<"game" | "sportsTest">("game");
  const [players, setPlayers] = useState<Player[]>([]);
  const [statLines, setStatLines] = useState<StatLineWithDate[]>([]);
  const [sportsTestRecords, setSportsTestRecords] = useState<SportsTestRecord[]>([]);
  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [quarter, setQuarter] = useState<number>(1);
  const [metric, setMetric] = useState<RankingMetric>("pts");
  const [testMetric, setTestMetric] = useState<SportsTestMetric>("sprint20m");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canViewKarte(role)) router.replace("/schedule");
  }, [role, router]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: p }, { data: lines }] = await Promise.all([
        supabase.from("players").select("*").neq("status", "OB・OG"),
        supabase
          .from("game_player_stat_lines")
          .select("*, game_matches(schedules(date, fiscal_year_override))")
          .returns<StatLineWithDate[]>(),
      ]);
      setPlayers(sortPlayers(p ?? []));
      setStatLines(lines ?? []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (category !== "sportsTest") return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("sports_test_records")
        .select("*")
        .eq("fiscal_year", fiscalYear)
        .eq("quarter", quarter)
        .eq("not_conducted", false);
      setSportsTestRecords(data ?? []);
    })();
  }, [category, fiscalYear, quarter]);

  const linesForYear = statLines.filter((l) => {
    const date = l.game_matches?.schedules?.date;
    if (!date) return false;
    return effectiveFiscalYear(date, l.game_matches?.schedules?.fiscal_year_override ?? null) === fiscalYear;
  });

  const gameRanked = players
    .map((p) => {
      const lines = linesForYear.filter((l) => l.player_id === p.id);
      const averages = computeSeasonAverages(lines);
      return { player: p, gp: averages.gp, value: averages[metric], sub: `GP ${averages.gp}` };
    })
    .filter((r) => r.gp > 0 && r.value !== null)
    .sort((a, b) => (b.value as number) - (a.value as number));

  const testMetricInfo = SPORTS_TEST_RANKING_METRICS.find((m) => m.value === testMetric)!;
  const testRanked = players
    .map((p) => {
      const record = sportsTestRecords.find((r) => r.player_id === p.id);
      const value = record ? testMetricInfo.extract(record) : null;
      return { player: p, value, sub: `${fiscalYear}年度 Q${quarter}` };
    })
    .filter((r) => r.value !== null)
    .sort((a, b) =>
      testMetricInfo.direction === "asc"
        ? (a.value as number) - (b.value as number)
        : (b.value as number) - (a.value as number),
    );

  const ranked = category === "game" ? gameRanked : testRanked;
  const unit = category === "game" ? RANKING_METRICS.find((m) => m.value === metric)!.unit : testMetricInfo.unit;

  return (
    <PageShell header={<AppHeader title="チームカルテ" variant="detail" backHref="/karte" />}>
      <div className="flex gap-1.5 mb-3">
        <SegButton active={category === "game"} onClick={() => setCategory("game")}>
          試合スタッツ
        </SegButton>
        <SegButton active={category === "sportsTest"} onClick={() => setCategory("sportsTest")}>
          スポーツテスト
        </SegButton>
      </div>

      <FieldLabel>年度</FieldLabel>
      <div className="relative inline-block mb-3">
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

      {category === "sportsTest" && (
        <>
          <FieldLabel>四半期</FieldLabel>
          <div className="flex gap-1.5 mb-3">
            {QUARTERS.map((q) => (
              <SegButton key={q} active={quarter === q} onClick={() => setQuarter(q)}>
                Q{q}
              </SegButton>
            ))}
          </div>
        </>
      )}

      <FieldLabel>項目</FieldLabel>
      {category === "game" ? (
        <div className="flex gap-1.5 flex-wrap mb-3">
          {RANKING_METRICS.map((m) => (
            <SegButton key={m.value} active={metric === m.value} onClick={() => setMetric(m.value)}>
              {m.label}
            </SegButton>
          ))}
        </div>
      ) : (
        <div className="flex gap-1.5 flex-wrap mb-3">
          {SPORTS_TEST_RANKING_METRICS.map((m) => (
            <SegButton key={m.value} active={testMetric === m.value} onClick={() => setTestMetric(m.value)}>
              {m.label}
            </SegButton>
          ))}
        </div>
      )}

      <Card>
        {loading ? (
          <EmptyState>読み込み中…</EmptyState>
        ) : ranked.length === 0 ? (
          <EmptyState>{category === "game" ? "この年度の出場記録がありません" : "この四半期の記録がありません"}</EmptyState>
        ) : (
          ranked.map((r, i) => (
            <Link
              key={r.player.id}
              href={`/karte/players/${r.player.id}`}
              className="flex items-center gap-2.5 py-2.5 border-b border-line last:border-b-0"
            >
              <div className="font-mono font-bold text-[13px] text-ink-soft w-5 flex-shrink-0 text-center">
                {i + 1}
              </div>
              <NumChip num={r.player.number ?? "-"} />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[13.5px]">{playerFullName(r.player)}</div>
                <div className="text-[11px] text-ink-soft mt-0.5">
                  {gradeLabel(r.player.grade)}・{r.sub}
                </div>
              </div>
              <div className="font-mono font-bold text-[15px] flex-shrink-0">
                {r.value}
                {unit}
              </div>
            </Link>
          ))
        )}
      </Card>
    </PageShell>
  );
}
