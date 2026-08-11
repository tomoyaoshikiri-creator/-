"use client";

import { useEffect, useState } from "react";
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
import { computeSeasonAverages, RANKING_METRICS, type RankingMetric } from "@/lib/karteAggregate";
import { effectiveFiscalYear, fiscalYearOf, gradeLabel, playerFullName, sortPlayers, todayDateStr } from "@/lib/format";
import Link from "next/link";
import type { GamePlayerStatLine, Player } from "@/lib/database.types";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());
const FISCAL_YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_FISCAL_YEAR - 4 + i);

interface StatLineWithDate extends GamePlayerStatLine {
  game_matches: { schedules: { date: string; fiscal_year_override: number | null } | null } | null;
}

export default function KarteRankingPage() {
  const router = useRouter();
  const { role } = useSession();
  const [players, setPlayers] = useState<Player[]>([]);
  const [statLines, setStatLines] = useState<StatLineWithDate[]>([]);
  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [metric, setMetric] = useState<RankingMetric>("pts");
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

  const linesForYear = statLines.filter((l) => {
    const date = l.game_matches?.schedules?.date;
    if (!date) return false;
    return effectiveFiscalYear(date, l.game_matches?.schedules?.fiscal_year_override ?? null) === fiscalYear;
  });

  const ranked = players
    .map((p) => {
      const lines = linesForYear.filter((l) => l.player_id === p.id);
      const averages = computeSeasonAverages(lines);
      return { player: p, averages };
    })
    .filter((r) => r.averages.gp > 0)
    .sort((a, b) => {
      const av = a.averages[metric] ?? -Infinity;
      const bv = b.averages[metric] ?? -Infinity;
      return (bv as number) - (av as number);
    });

  const metricInfo = RANKING_METRICS.find((m) => m.value === metric)!;

  return (
    <PageShell header={<AppHeader title="ランキング" variant="detail" backHref="/karte" />}>
      <div className="mt-1">
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
      </div>

      <FieldLabel>項目</FieldLabel>
      <div className="flex gap-1.5 flex-wrap mb-3">
        {RANKING_METRICS.map((m) => (
          <SegButton key={m.value} active={metric === m.value} onClick={() => setMetric(m.value)}>
            {m.label}
          </SegButton>
        ))}
      </div>

      <Card>
        {loading ? (
          <EmptyState>読み込み中…</EmptyState>
        ) : ranked.length === 0 ? (
          <EmptyState>この年度の出場記録がありません</EmptyState>
        ) : (
          ranked.map((r, i) => (
            <Link
              key={r.player.id}
              href={`/karte/${r.player.id}`}
              className="flex items-center gap-2.5 py-2.5 border-b border-line last:border-b-0"
            >
              <div className="font-mono font-bold text-[13px] text-ink-soft w-5 flex-shrink-0 text-center">
                {i + 1}
              </div>
              <NumChip num={r.player.number ?? "-"} />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[13.5px]">{playerFullName(r.player)}</div>
                <div className="text-[11px] text-ink-soft mt-0.5">
                  {gradeLabel(r.player.grade)}・GP {r.averages.gp}
                </div>
              </div>
              <div className="font-mono font-bold text-[15px] flex-shrink-0">
                {r.averages[metric] ?? "-"}
                {metricInfo.unit}
              </div>
            </Link>
          ))
        )}
      </Card>
    </PageShell>
  );
}
