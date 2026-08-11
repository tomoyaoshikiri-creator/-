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
import { StatCell } from "@/components/karte/StatCell";
import {
  computeSeasonAverages,
  computeTeamAverages,
  GAME_COLUMNS,
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

type SportsTestValues = Partial<Record<SportsTestMetric, number | null>>;

// FG/FTは「成功数/試投数」の分数表示になるため、他の列より少し幅を広げる。
const colWidthClass = (key: keyof SeasonStatAverages) =>
  key === "fgPct" || key === "ftPct" ? "w-[58px] min-w-[58px]" : "w-[50px] min-w-[50px]";

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
  const gameRows =
    gameRankingMode
      ? [...playerAverages].sort((a, b) => sortValue(b.averages) - sortValue(a.averages))
      : playerAverages;

  // 在籍中の選手は常に表示。OB・OGは選んだ年度・四半期に記録がある場合だけ一覧に含める。
  const sportsTestPlayers = players.filter(
    (p) => p.status !== "OB・OG" || sportsTestRecords.some((r) => r.player_id === p.id),
  );
  const sportsTestValues: { player: Player; values: SportsTestValues }[] = sportsTestPlayers.map((p) => {
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
        {category === "sportsTest" && (
          <button
            type="button"
            onClick={() => setSportsTestRankingMode((v) => !v)}
            className={`flex-none text-center px-5 py-2 rounded-[10px] font-bold text-[13px] border ${
              sportsTestRankingMode ? "border-orange bg-orange text-white" : "border-line text-ink-soft bg-white"
            }`}
          >
            {sportsTestRankingMode ? "ランキング中" : "ランキングで見る"}
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
                        className={`sticky top-0 h-9 bg-paper z-20 ${colWidthClass(c.key)} px-1 border-b border-line font-bold whitespace-nowrap text-center ${
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
          </>
        )
      ) : (
        <>
          <FieldLabel>四半期</FieldLabel>
          <div className="flex gap-1.5 mb-3">
            {QUARTERS.map((q) => (
              <SegButton key={q} active={quarter === q} onClick={() => setQuarter(q)}>
                Q{q}
              </SegButton>
            ))}
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
                      <th className="sticky left-0 top-0 h-11 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap">
                        選手
                      </th>
                      {SPORTS_TEST_RANKING_METRICS.map((m) => (
                        <th
                          key={m.value}
                          onClick={() => sportsTestRankingMode && setSportsTestSortKey(m.value)}
                          className={`sticky top-0 h-11 bg-paper z-20 w-[54px] min-w-[54px] px-1 border-b border-line font-bold text-center leading-tight ${
                            sportsTestRankingMode ? "cursor-pointer" : ""
                          } ${sportsTestRankingMode && sportsTestSortKey === m.value ? "text-orange" : "text-ink-soft"}`}
                        >
                          <div className="whitespace-nowrap">{m.abbrLines[0]}</div>
                          <div className="whitespace-nowrap">{m.abbrLines[1]}</div>
                        </th>
                      ))}
                    </tr>
                    <tr className="bg-paper">
                      <th className="sticky left-0 top-11 h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap font-bold">
                        チーム平均
                      </th>
                      {SPORTS_TEST_RANKING_METRICS.map((m) => {
                        const v = sportsTestTeamAverages[m.value];
                        return (
                          <th
                            key={m.value}
                            className="sticky top-11 h-9 bg-paper z-20 w-[54px] min-w-[54px] px-1 text-center font-mono font-bold border-b border-line"
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
                    {m.abbrLines.join("")}:{m.label}
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
