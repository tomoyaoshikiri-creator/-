"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { canViewKarte } from "@/lib/permissions";
import { hasKarteTabAccess } from "@/lib/plan";
import { StatCell } from "@/components/karte/StatCell";
import {
  computeSeasonAverages,
  computeTeamAverages,
  GAME_COLUMNS,
  type SeasonStatAverages,
} from "@/lib/karteAggregate";
import { effectiveFiscalYear, fiscalYearOf, playerFullName, sortPlayers, todayDateStr } from "@/lib/format";
import type { Database, GamePlayerStatLine, Player } from "@/lib/database.types";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());
const FISCAL_YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_FISCAL_YEAR - 4 + i);

interface StatLineWithDate extends GamePlayerStatLine {
  game_matches: { schedules: { date: string; fiscal_year_override: number | null } | null } | null;
}

type TeamAverageRow = Database["public"]["Functions"]["team_game_stat_averages"]["Returns"][number];

function toSeasonStatAverages(row: TeamAverageRow): SeasonStatAverages {
  return {
    gp: 0,
    pts: row.pts ?? 0,
    fgMade: 0,
    ftMade: 0,
    reb: 0,
    rebOff: row.reb_off ?? 0,
    rebDef: row.reb_def ?? 0,
    ast: row.ast ?? 0,
    stl: row.stl ?? 0,
    blk: row.blk ?? 0,
    tov: row.tov ?? 0,
    fouls: 0,
    eff: row.eff ?? 0,
    fgPct: row.fg_pct,
    ftPct: row.ft_pct,
    fgMadeTotal: row.fg_made_total,
    fgAttTotal: row.fg_att_total,
    ftMadeTotal: row.ft_made_total,
    ftAttTotal: row.ft_att_total,
  };
}

// FG/FTは「成功数/試投数」の分数表示になるため、他の列より少し幅を広げる。
const colWidthClass = (key: keyof SeasonStatAverages) =>
  key === "fgPct" || key === "ftPct" ? "w-[58px] min-w-[58px]" : "w-[50px] min-w-[50px]";

function GameStatLegend() {
  return (
    <ul className="text-[10.5px] text-ink-soft leading-relaxed mb-2.5 pl-4 list-disc space-y-0.5">
      <li>PTS:得点</li>
      <li>FG%:フィールドゴール成功率(下段は成功数/試投数)</li>
      <li>FT%:フリースロー成功率(下段は成功数/試投数)</li>
      <li>AST:アシスト</li>
      <li>OREB:オフェンスリバウンド</li>
      <li>DREB:ディフェンスリバウンド</li>
      <li>STL:スティール</li>
      <li>BLK:ブロック</li>
      <li>TO:ターンオーバー</li>
      <li>EFF:得点+リバウンド+アシスト+スティール+ブロック−(FG失敗+FT失敗+ターンオーバー)</li>
    </ul>
  );
}

export default function KarteTeamGamePage() {
  const router = useRouter();
  const { role, plan } = useSession();
  const isStaff = canViewKarte(role);

  useEffect(() => {
    if (!hasKarteTabAccess(plan)) router.replace("/karte");
  }, [plan, router]);

  const [players, setPlayers] = useState<Player[]>([]);
  const [statLines, setStatLines] = useState<StatLineWithDate[]>([]);
  const [teamAverageRow, setTeamAverageRow] = useState<TeamAverageRow | null>(null);
  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [rankingMode, setRankingMode] = useState(false);
  const [sortKey, setSortKey] = useState<keyof SeasonStatAverages>("pts");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isStaff) return;
    (async () => {
      const supabase = createClient();
      const [{ data: p }, { data: lines }] = await Promise.all([
        supabase.from("players").select("*"),
        supabase
          .from("game_player_stat_lines")
          .select("*, game_matches(schedules(date, fiscal_year_override))")
          .returns<StatLineWithDate[]>(),
      ]);
      setPlayers(sortPlayers(p ?? []));
      setStatLines(lines ?? []);
      setLoading(false);
    })();
  }, [isStaff]);

  useEffect(() => {
    if (isStaff) return;
    setLoading(true);
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("team_game_stat_averages", { p_fiscal_year: fiscalYear });
      setTeamAverageRow(data?.[0] ?? null);
      setLoading(false);
    })();
  }, [isStaff, fiscalYear]);

  const linesForYear = statLines.filter((l) => {
    const date = l.game_matches?.schedules?.date;
    if (!date) return false;
    return effectiveFiscalYear(date, l.game_matches?.schedules?.fiscal_year_override ?? null) === fiscalYear;
  });

  // 在籍中の選手は常に表示。OB・OGは選んだ年度に出場記録がある場合だけ一覧に含める。
  const gamePlayers = players.filter(
    (p) => p.status !== "OB・OG" || linesForYear.some((l) => l.player_id === p.id),
  );
  const playerAverages = gamePlayers.map((p) => ({
    player: p,
    averages: computeSeasonAverages(linesForYear.filter((l) => l.player_id === p.id)),
  }));
  const teamAverages = computeTeamAverages(
    playerAverages.map((pa) => pa.averages),
    linesForYear,
  );
  const sortValue = (a: SeasonStatAverages) => (a[sortKey] as number | null) ?? -Infinity;
  const gameRows = rankingMode
    ? [...playerAverages].sort((a, b) => sortValue(b.averages) - sortValue(a.averages))
    : playerAverages;

  return (
    <PageShell
      header={
        <AppHeader
          title="スタッツ"
          variant="detail"
          backHref="/karte/team"
          accessBadge={isStaff ? "coach" : undefined}
        />
      }
    >
      <div className="flex items-center gap-2 mb-3">
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
        {isStaff && (
          <button
            type="button"
            onClick={() => setRankingMode((v) => !v)}
            className={`flex-none text-center px-5 py-2 rounded-[10px] font-bold text-[13px] border ${
              rankingMode ? "border-orange bg-orange text-white" : "border-line text-ink-soft bg-white"
            }`}
          >
            {rankingMode ? "ランキング中" : "ランキングで見る"}
          </button>
        )}
      </div>

      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : !isStaff ? (
        <>
          <Card>
            <div className="text-[11.5px] font-bold text-ink-soft mb-3">チーム平均</div>
            {!teamAverageRow || teamAverageRow.player_count === 0 ? (
              <div className="text-xs text-ink-soft">この年度の出場記録はありません</div>
            ) : (
              <div className="grid grid-cols-5 gap-y-3 text-center">
                {GAME_COLUMNS.map((c) => (
                  <div key={c.key}>
                    <div className="text-[10px] text-ink-soft font-bold">{c.abbr}</div>
                    <div className="font-mono font-bold text-[13px] mt-0.5">
                      <StatCell statKey={c.key} averages={toSeasonStatAverages(teamAverageRow)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <GameStatLegend />
        </>
      ) : (
        <>
          {rankingMode && (
            <div className="text-[11px] text-ink-soft mb-1.5">項目名をタップすると、その項目順に並び替わります</div>
          )}

          <div className="bg-white border border-line rounded-2xl overflow-auto max-h-[65vh] mb-2.5">
            <table className="border-collapse text-[11.5px] w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap">
                    選手
                  </th>
                  {GAME_COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      onClick={() => rankingMode && setSortKey(c.key)}
                      className={`sticky top-0 h-9 bg-paper z-20 ${colWidthClass(c.key)} px-1 border-b border-line font-bold whitespace-nowrap text-center ${
                        rankingMode ? "cursor-pointer" : ""
                      } ${rankingMode && sortKey === c.key ? "text-orange" : "text-ink-soft"}`}
                    >
                      {c.abbr}
                    </th>
                  ))}
                </tr>
                <tr className="bg-paper">
                  <th className="sticky left-0 top-9 h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap font-bold">
                    チーム平均
                  </th>
                  {GAME_COLUMNS.map((c) => {
                    const v = teamAverages[c.key] as number | null;
                    return (
                      <th
                        key={c.key}
                        className={`sticky top-9 h-9 bg-paper z-20 ${colWidthClass(c.key)} px-1 text-center font-mono font-bold border-b border-line whitespace-nowrap ${
                          c.key === "eff" && v !== null && v < 0 ? "text-danger" : ""
                        }`}
                      >
                        <StatCell statKey={c.key} averages={teamAverages} />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {gameRows.map(({ player: p, averages }) => (
                  <tr key={p.id}>
                    <td className="sticky left-0 bg-white z-10 px-2.5 py-2 whitespace-nowrap border-b border-line last:border-b-0">
                      <Link href={`/karte/players/${p.id}`} className="font-bold">
                        #{p.number ?? "-"} {playerFullName(p)}
                      </Link>
                    </td>
                    {GAME_COLUMNS.map((c) => {
                      const v = averages[c.key] as number | null;
                      return (
                        <td
                          key={c.key}
                          className={`${colWidthClass(c.key)} px-1 py-2 text-center font-mono border-b border-line last:border-b-0 whitespace-nowrap ${
                            c.key === "eff" && v !== null && v < 0 ? "text-danger" : ""
                          }`}
                        >
                          <StatCell statKey={c.key} averages={averages} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <GameStatLegend />
        </>
      )}
    </PageShell>
  );
}
