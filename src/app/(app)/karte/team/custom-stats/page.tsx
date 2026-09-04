"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState } from "@/components/ui/Card";
import { InlineSelect } from "@/components/ui/InlineSelect";
import { canViewKarte } from "@/lib/permissions";
import { hasKarteTabAccess } from "@/lib/plan";
import { usesDetailedBasketballStats } from "@/lib/sport";
import {
  computeCustomSeasonAverages,
  computeCustomTeamAverages,
  type CustomStatSeasonAverages,
} from "@/lib/karteAggregate";
import { fiscalYearOf, playerFullName, sortPlayers, todayDateStr } from "@/lib/format";
import type { Database, GamePlayerStatEntry, Player, TeamStatCategory } from "@/lib/database.types";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());
const FISCAL_YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_FISCAL_YEAR - 4 + i);

type TeamAverageRow = Database["public"]["Functions"]["team_stat_category_averages"]["Returns"][number];

interface StatEntryWithDate extends GamePlayerStatEntry {
  game_matches: { schedules: { date: string; fiscal_year_override: number | null } | null } | null;
}

export default function KarteTeamCustomStatsPage() {
  const router = useRouter();
  const { role, plan, sport } = useSession();
  const isStaff = canViewKarte(role);

  useEffect(() => {
    if (!hasKarteTabAccess(plan)) router.replace("/team");
    else if (usesDetailedBasketballStats(sport)) router.replace("/karte/team");
  }, [plan, sport, router]);

  const [categories, setCategories] = useState<TeamStatCategory[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [entries, setEntries] = useState<StatEntryWithDate[]>([]);
  const [teamAverageRows, setTeamAverageRows] = useState<TeamAverageRow[]>([]);
  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isStaff) return;
    (async () => {
      const supabase = createClient();
      const [{ data: c }, { data: p }, { data: e }] = await Promise.all([
        supabase.from("team_stat_categories").select("*").order("position", { ascending: true }),
        supabase.from("players").select("*"),
        supabase
          .from("game_player_stat_entries")
          .select("*, game_matches(schedules(date, fiscal_year_override))")
          .returns<StatEntryWithDate[]>(),
      ]);
      setCategories(c ?? []);
      setPlayers(sortPlayers(p ?? []));
      setEntries(e ?? []);
      setLoading(false);
    })();
  }, [isStaff]);

  useEffect(() => {
    if (isStaff) return;
    setLoading(true);
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("team_stat_category_averages", { p_fiscal_year: fiscalYear });
      setTeamAverageRows(data ?? []);
      setLoading(false);
    })();
  }, [isStaff, fiscalYear]);

  const entriesForYear = entries.filter((e) => {
    const date = e.game_matches?.schedules?.date;
    if (!date) return false;
    const y = e.game_matches?.schedules?.fiscal_year_override ?? fiscalYearOf(date);
    return y === fiscalYear;
  });

  const activePlayers = players.filter((p) => p.status !== "OB・OG");
  const playerAverages: { player: Player; averages: CustomStatSeasonAverages }[] = activePlayers.map((p) => ({
    player: p,
    averages: computeCustomSeasonAverages(
      entriesForYear.filter((e) => e.player_id === p.id),
      categories,
    ),
  }));
  const teamAverages = computeCustomTeamAverages(
    playerAverages.map((pa) => pa.averages),
    categories,
  );

  return (
    <PageShell
      header={
        <AppHeader title="スタッツ" variant="detail" backHref="/karte/team" accessBadge={isStaff ? "coach" : undefined} />
      }
    >
      <div className="flex items-center gap-2 mb-3">
        <InlineSelect
          value={String(fiscalYear)}
          onChange={(v) => setFiscalYear(Number(v))}
          options={FISCAL_YEAR_OPTIONS.map((y) => ({ value: String(y), label: `${y}年度` }))}
        />
      </div>

      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : !isStaff ? (
        <Card>
          <div className="text-[11.5px] font-bold text-ink-soft mb-3">チーム平均</div>
          {teamAverageRows.length === 0 ? (
            <div className="text-xs text-ink-soft">この年度の記録はありません</div>
          ) : (
            <div className="grid grid-cols-3 gap-y-3 text-center">
              {teamAverageRows.map((row) => (
                <div key={row.category_id}>
                  <div className="text-[10px] text-ink-soft font-bold">{row.category_name}</div>
                  <div className="font-mono font-bold text-[13px] mt-0.5">
                    {row.player_count === 0 ? "-" : row.avg_value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : categories.length === 0 ? (
        <EmptyState>まだスタッツ項目がありません</EmptyState>
      ) : (
        <div className="bg-white border border-line rounded-lg overflow-auto max-h-[65vh] mb-2.5">
          <table className="border-collapse text-[11.5px] w-full">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap">
                  選手
                </th>
                {categories.map((c) => (
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
                  チーム平均
                </th>
                {categories.map((c) => (
                  <th
                    key={c.id}
                    className="sticky top-9 h-9 bg-paper z-20 w-[58px] min-w-[58px] px-1 text-center font-mono font-bold border-b border-line whitespace-nowrap"
                  >
                    {teamAverages.averages[c.id] ?? 0}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {playerAverages.map(({ player: p, averages }) => (
                <tr key={p.id}>
                  <td className="sticky left-0 bg-white z-10 px-2.5 py-2 whitespace-nowrap border-b border-line last:border-b-0 font-bold">
                    #{p.number ?? "-"} {playerFullName(p)}
                  </td>
                  {categories.map((c) => (
                    <td
                      key={c.id}
                      className="w-[58px] min-w-[58px] px-1 py-2 text-center font-mono border-b border-line last:border-b-0 whitespace-nowrap"
                    >
                      {averages.averages[c.id] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
