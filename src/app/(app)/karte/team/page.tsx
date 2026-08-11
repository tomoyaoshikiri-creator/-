"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { EmptyState } from "@/components/ui/Card";
import { SegButton, FieldLabel } from "@/components/ui/SegButton";
import { ChevronRightIcon } from "@/components/icons";
import { canViewKarte } from "@/lib/permissions";
import {
  computeSeasonAverages,
  computeTeamGameAverages,
  SPORTS_TEST_RANKING_METRICS,
  type SeasonStatAverages,
  type SportsTestMetric,
} from "@/lib/karteAggregate";
import { effectiveFiscalYear, fiscalYearOf, playerFullName, sortPlayers, todayDateStr } from "@/lib/format";
import type { GamePlayerStatLine, Player, SportsTestRecord } from "@/lib/database.types";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());
const FISCAL_YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_FISCAL_YEAR - 4 + i);
const QUARTERS = [1, 2, 3, 4] as const;

interface StatLineWithDate extends GamePlayerStatLine {
  game_matches: { schedules: { date: string; fiscal_year_override: number | null } | null } | null;
}

// 得点・FG成功・FT成功・アシスト・OFリバウンド・DFリバウンド・スティール・ブロック・ターンオーバー・EFFの順。
// スマホ幅に収まらないため、列見出しはExcelと同じ英字略称にしている。
const PERCENT_COLUMNS = new Set<keyof SeasonStatAverages>(["fgPct", "ftPct"]);

const GAME_COLUMNS: { key: keyof SeasonStatAverages; abbr: string }[] = [
  { key: "pts", abbr: "PTS" },
  { key: "fgPct", abbr: "FG" },
  { key: "ftPct", abbr: "FT" },
  { key: "ast", abbr: "AST" },
  { key: "rebOff", abbr: "OREB" },
  { key: "rebDef", abbr: "DREB" },
  { key: "stl", abbr: "STL" },
  { key: "blk", abbr: "BLK" },
  { key: "tov", abbr: "TO" },
  { key: "eff", abbr: "EFF" },
];

type SportsTestValues = Partial<Record<SportsTestMetric, number | null>>;

export default function KarteTeamPage() {
  const router = useRouter();
  const { role } = useSession();
  const [category, setCategory] = useState<"game" | "sportsTest">("game");
  const [players, setPlayers] = useState<Player[]>([]);
  const [statLines, setStatLines] = useState<StatLineWithDate[]>([]);
  const [sportsTestRecords, setSportsTestRecords] = useState<SportsTestRecord[]>([]);
  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [quarter, setQuarter] = useState<number>(1);
  const [gameRankingMode, setGameRankingMode] = useState(false);
  const [sortKey, setSortKey] = useState<keyof SeasonStatAverages>("pts");
  const [sportsTestRankingMode, setSportsTestRankingMode] = useState(false);
  const [sportsTestSortKey, setSportsTestSortKey] = useState<SportsTestMetric>("sprint20m");
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

  const teamAverages = computeTeamGameAverages(linesForYear);
  const playerAverages = players.map((p) => ({
    player: p,
    averages: computeSeasonAverages(linesForYear.filter((l) => l.player_id === p.id)),
  }));
  const sortValue = (a: SeasonStatAverages) => (a[sortKey] as number | null) ?? -Infinity;
  const gameRows =
    gameRankingMode
      ? [...playerAverages].sort((a, b) => sortValue(b.averages) - sortValue(a.averages))
      : playerAverages;

  const sportsTestValues: { player: Player; values: SportsTestValues }[] = players.map((p) => {
    const record = sportsTestRecords.find((r) => r.player_id === p.id);
    const values: SportsTestValues = {};
    SPORTS_TEST_RANKING_METRICS.forEach((m) => {
      values[m.value] = record ? m.extract(record) : null;
    });
    return { player: p, values };
  });
  const sportsTestTeamAverages: SportsTestValues = {};
  SPORTS_TEST_RANKING_METRICS.forEach((m) => {
    const nums = sportsTestValues
      .map((v) => v.values[m.value])
      .filter((v): v is number => v !== null && v !== undefined);
    sportsTestTeamAverages[m.value] =
      nums.length > 0 ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;
  });
  const sportsTestSortInfo = SPORTS_TEST_RANKING_METRICS.find((m) => m.value === sportsTestSortKey)!;
  const sportsTestSortValue = (v: SportsTestValues) => {
    const val = v[sportsTestSortKey];
    if (val === null || val === undefined) return sportsTestSortInfo.direction === "asc" ? Infinity : -Infinity;
    return val;
  };
  const sportsTestRows = sportsTestRankingMode
    ? [...sportsTestValues].sort((a, b) =>
        sportsTestSortInfo.direction === "asc"
          ? sportsTestSortValue(a.values) - sportsTestSortValue(b.values)
          : sportsTestSortValue(b.values) - sportsTestSortValue(a.values),
      )
    : sportsTestValues;

  return (
    <PageShell header={<AppHeader title="チームカルテ" variant="detail" backHref="/karte" accessBadge="coach" />}>
      <div className="flex gap-1.5 mb-3">
        <SegButton active={category === "game"} onClick={() => setCategory("game")}>
          試合スタッツ
        </SegButton>
        <SegButton active={category === "sportsTest"} onClick={() => setCategory("sportsTest")}>
          スポーツテスト
        </SegButton>
      </div>

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
        {category === "game" && (
          <button
            type="button"
            onClick={() => setGameRankingMode((v) => !v)}
            className={`flex-none text-center px-5 py-2 rounded-[10px] font-bold text-[13px] border ${
              gameRankingMode ? "border-orange bg-orange text-white" : "border-line text-ink-soft bg-white"
            }`}
          >
            {gameRankingMode ? "ランキング中" : "ランキングで見る"}
          </button>
        )}
      </div>

      {category === "game" ? (
        loading ? (
          <EmptyState>読み込み中…</EmptyState>
        ) : (
          <>
            {gameRankingMode && (
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
                        onClick={() => gameRankingMode && setSortKey(c.key)}
                        className={`sticky top-0 h-9 bg-paper z-20 w-[50px] min-w-[50px] px-1 border-b border-line font-bold whitespace-nowrap text-center ${
                          gameRankingMode ? "cursor-pointer" : ""
                        } ${gameRankingMode && sortKey === c.key ? "text-orange" : "text-ink-soft"}`}
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
                          className={`sticky top-9 h-9 bg-paper z-20 w-[50px] min-w-[50px] px-1 text-center font-mono font-bold border-b border-line ${
                            c.key === "eff" && v !== null && v < 0 ? "text-danger" : ""
                          }`}
                        >
                          {v === null ? "-" : `${v}${PERCENT_COLUMNS.has(c.key) ? "%" : ""}`}
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
                            className={`w-[50px] min-w-[50px] px-1 py-2 text-center font-mono border-b border-line last:border-b-0 ${
                              c.key === "eff" && v !== null && v < 0 ? "text-danger" : ""
                            }`}
                          >
                            {v === null ? "-" : `${v}${PERCENT_COLUMNS.has(c.key) ? "%" : ""}`}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="text-[10.5px] text-ink-soft leading-relaxed mb-2.5 pl-4 list-disc space-y-0.5">
              <li>PTS:得点</li>
              <li>FG:フィールドゴール成功率</li>
              <li>FT:フリースロー成功率</li>
              <li>AST:アシスト</li>
              <li>OREB:オフェンスリバウンド</li>
              <li>DREB:ディフェンスリバウンド</li>
              <li>STL:スティール</li>
              <li>BLK:ブロック</li>
              <li>TO:ターンオーバー</li>
              <li>EFF:得点+リバウンド+アシスト+スティール+ブロック−(FG失敗+FT失敗+ターンオーバー)</li>
            </ul>
          </>
        )
      ) : (
        <>
          <FieldLabel>四半期</FieldLabel>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex gap-1.5">
              {QUARTERS.map((q) => (
                <SegButton key={q} active={quarter === q} onClick={() => setQuarter(q)}>
                  Q{q}
                </SegButton>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSportsTestRankingMode((v) => !v)}
              className={`flex-none text-center px-4 py-2 rounded-[10px] font-bold text-[13px] border ${
                sportsTestRankingMode ? "border-orange bg-orange text-white" : "border-line text-ink-soft bg-white"
              }`}
            >
              {sportsTestRankingMode ? "ランキング中" : "ランキングで見る"}
            </button>
          </div>

          {loading ? (
            <EmptyState>読み込み中…</EmptyState>
          ) : (
            <>
              {sportsTestRankingMode && (
                <div className="text-[11px] text-ink-soft mb-1.5">項目名をタップすると、その項目順に並び替わります</div>
              )}

              <div className="bg-white border border-line rounded-2xl overflow-auto max-h-[65vh] mb-2.5">
                <table className="border-collapse text-[11.5px] w-full">
                  <thead>
                    <tr>
                      <th className="sticky left-0 top-0 h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap">
                        選手
                      </th>
                      {SPORTS_TEST_RANKING_METRICS.map((m) => (
                        <th
                          key={m.value}
                          onClick={() => sportsTestRankingMode && setSportsTestSortKey(m.value)}
                          className={`sticky top-0 h-9 bg-paper z-20 w-[54px] min-w-[54px] px-1 border-b border-line font-bold whitespace-nowrap text-center ${
                            sportsTestRankingMode ? "cursor-pointer" : ""
                          } ${sportsTestRankingMode && sportsTestSortKey === m.value ? "text-orange" : "text-ink-soft"}`}
                        >
                          {m.abbr}
                        </th>
                      ))}
                    </tr>
                    <tr className="bg-paper">
                      <th className="sticky left-0 top-9 h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap font-bold">
                        チーム平均
                      </th>
                      {SPORTS_TEST_RANKING_METRICS.map((m) => {
                        const v = sportsTestTeamAverages[m.value];
                        return (
                          <th
                            key={m.value}
                            className="sticky top-9 h-9 bg-paper z-20 w-[54px] min-w-[54px] px-1 text-center font-mono font-bold border-b border-line"
                          >
                            {v === null || v === undefined ? "-" : v}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sportsTestRows.map(({ player: p, values }) => (
                      <tr key={p.id}>
                        <td className="sticky left-0 bg-white z-10 px-2.5 py-2 whitespace-nowrap border-b border-line last:border-b-0">
                          <Link href={`/karte/players/${p.id}`} className="font-bold">
                            #{p.number ?? "-"} {playerFullName(p)}
                          </Link>
                        </td>
                        {SPORTS_TEST_RANKING_METRICS.map((m) => {
                          const v = values[m.value];
                          return (
                            <td
                              key={m.value}
                              className="w-[54px] min-w-[54px] px-1 py-2 text-center font-mono border-b border-line last:border-b-0"
                            >
                              {v === null || v === undefined ? "-" : v}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="text-[10.5px] text-ink-soft leading-relaxed mb-2.5 pl-4 list-disc space-y-0.5">
                {SPORTS_TEST_RANKING_METRICS.map((m) => (
                  <li key={m.value}>
                    {m.abbr}:{m.label}
                    {m.unit ? `(${m.unit})` : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
