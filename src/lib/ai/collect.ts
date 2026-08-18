import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  GamePlayerStatEntry,
  GamePlayerStatLine,
  SportsTestRecord,
} from "@/lib/database.types";
import { usesDetailedBasketballStats } from "@/lib/sport";
import { effectiveFiscalYear, gradeLabel, playerFullName } from "@/lib/format";
import {
  GAME_COLUMNS,
  THREE_POINT_GAME_COLUMNS,
  computeSeasonAverages,
  computeTeamAverages,
  computeCustomSeasonAverages,
  SPORTS_TEST_RANKING_METRICS,
  type SeasonStatAverages,
} from "@/lib/karteAggregate";
import { assessPlayerDataQuality, assessTeamDataQuality } from "./dataQuality";
import type {
  AiPlanKind,
  CustomStatCategoryInfo,
  PlayerAnalysisData,
  PracticeMenuSummary,
  PracticeParticipationSummary,
  StatsData,
  TeamAnalysisData,
  TeamPracticeParticipationSummary,
  TeamSportsTestData,
  TeamSportsTestMetricSummary,
} from "./types";

type DB = SupabaseClient<Database>;

// database.types.tsは手書きのためRelationshipsが空になっており、supabase-jsの型推論だけでは
// game_matches(schedules(...))のような埋め込みの型を解決できない。karte画面側の既存パターンと
// 同じく、ローカルの型 + .returns<T>() で明示する。
interface StatLineWithDate extends GamePlayerStatLine {
  game_matches: { opponent: string | null; schedules: { date: string; fiscal_year_override: number | null } | null } | null;
}
interface StatEntryWithDate extends GamePlayerStatEntry {
  game_matches: { opponent: string | null; schedules: { date: string; fiscal_year_override: number | null } | null } | null;
}

// GAME_COLUMNS/THREE_POINT_GAME_COLUMNSのkeyから読める値だけを、AIに渡す
// プレーンなRecord<string, number|null>に変換する(SeasonStatAveragesの内部表現を
// そのまま渡さず、abbr(PTS等)をキーにして意味が伝わりやすくする)。
function basketballAveragesToRecord(
  averages: SeasonStatAverages,
  includeThreePoint: boolean,
): Record<string, number | null> {
  const cols = includeThreePoint ? [...GAME_COLUMNS, ...THREE_POINT_GAME_COLUMNS] : GAME_COLUMNS;
  const out: Record<string, number | null> = {};
  cols.forEach((c) => {
    out[c.abbr] = averages[c.key] as number | null;
  });
  return out;
}

async function fetchActivePlayers(supabase: DB) {
  const { data } = await supabase.from("players").select("*").neq("status", "OB・OG");
  return data ?? [];
}

async function fetchPracticeSchedulesInYear(supabase: DB, fiscalYear: number) {
  const { data } = await supabase.from("schedules").select("id, date").eq("type", "practice");
  return (data ?? []).filter((s) => effectiveFiscalYear(s.date, null) === fiscalYear);
}

function practiceParticipation(
  practicesHeld: number,
  statuses: string[],
): PracticeParticipationSummary {
  const attended = statuses.filter((s) => s === "出席").length;
  const late = statuses.filter((s) => s === "遅刻早退").length;
  const observed = statuses.filter((s) => s === "見学").length;
  const absent = statuses.filter((s) => s === "欠席").length;
  const participationRate = practicesHeld > 0 ? Math.round(((attended + late) / practicesHeld) * 1000) / 10 : null;
  return { practicesHeld, attended, late, observed, absent, participationRate };
}

// ============ 選手分析 ============

export async function collectPlayerAnalysisData(
  supabase: DB,
  params: { playerId: string; fiscalYear: number; sport: Database["public"]["Tables"]["teams"]["Row"]["sport"]; planKind: AiPlanKind },
): Promise<PlayerAnalysisData> {
  const { playerId, fiscalYear, sport, planKind } = params;

  const { data: player } = await supabase.from("players").select("*").eq("id", playerId).single();
  if (!player) throw new Error("選手情報が見つかりません");

  const basketball = usesDetailedBasketballStats(sport);
  const includeThreePoint = sport === "バスケットボール";

  let stats: StatsData;
  let gameCount: number;
  if (basketball) {
    const { data: lines } = await supabase
      .from("game_player_stat_lines")
      .select("*, game_matches(opponent, schedules(date, fiscal_year_override))")
      .eq("player_id", playerId)
      .returns<StatLineWithDate[]>();
    const seasonLines = (lines ?? []).filter((l) => {
      const date = l.game_matches?.schedules?.date;
      if (!date) return false;
      return effectiveFiscalYear(date, l.game_matches?.schedules?.fiscal_year_override ?? null) === fiscalYear;
    });
    const seasonAverages = computeSeasonAverages(seasonLines);
    gameCount = seasonAverages.gp;
    stats = {
      kind: "basketball",
      gameCount,
      seasonAverages: basketballAveragesToRecord(seasonAverages, includeThreePoint),
      games: seasonLines
        .sort((a, b) => (a.game_matches?.schedules?.date ?? "").localeCompare(b.game_matches?.schedules?.date ?? ""))
        .map((l) => ({
          label: `${l.game_matches?.schedules?.date ?? "-"} vs ${l.game_matches?.opponent ?? "-"}`,
          averages: basketballAveragesToRecord(computeSeasonAverages([l]), includeThreePoint),
        })),
    };
  } else {
    const [{ data: categories }, { data: entries }] = await Promise.all([
      supabase.from("team_stat_categories").select("*").order("position", { ascending: true }),
      supabase
        .from("game_player_stat_entries")
        .select("*, game_matches(opponent, schedules(date, fiscal_year_override))")
        .eq("player_id", playerId)
        .returns<StatEntryWithDate[]>(),
    ]);
    const seasonEntries = (entries ?? []).filter((e) => {
      const date = e.game_matches?.schedules?.date;
      if (!date) return false;
      return effectiveFiscalYear(date, e.game_matches?.schedules?.fiscal_year_override ?? null) === fiscalYear;
    });
    const cats = categories ?? [];
    const seasonTotals = computeCustomSeasonAverages(seasonEntries, cats);
    gameCount = seasonTotals.gp;
    const categoryInfos: CustomStatCategoryInfo[] = cats.map((c) => ({
      name: c.name,
      unit: c.unit,
      description: c.description,
      evaluationDirection: c.evaluation_direction,
      seasonTotal: seasonTotals.totals[c.id] ?? 0,
      seasonAverage: seasonTotals.averages[c.id] ?? 0,
    }));
    const matchIds = Array.from(new Set(seasonEntries.map((e) => e.match_id)));
    const games = matchIds
      .map((matchId) => {
        const matchEntries = seasonEntries.filter((e) => e.match_id === matchId);
        const first = matchEntries[0];
        const values: Record<string, number> = {};
        cats.forEach((c) => {
          const entry = matchEntries.find((e) => e.category_id === c.id);
          if (entry) values[c.name] = entry.value;
        });
        return {
          date: first.game_matches?.schedules?.date ?? "",
          label: `${first.game_matches?.schedules?.date ?? "-"} vs ${first.game_matches?.opponent ?? "-"}`,
          values,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(({ label, values }) => ({ label, values }));
    stats = { kind: "custom", gameCount, categories: categoryInfos, games };
  }

  let sportsTest: PlayerAnalysisData["sportsTest"] = null;
  let sportsTestQuarterCount: number | null = null;
  if (planKind === "max") {
    const { data: records } = await supabase
      .from("sports_test_records")
      .select("*")
      .eq("player_id", playerId)
      .eq("not_conducted", false)
      .order("fiscal_year", { ascending: true })
      .order("quarter", { ascending: true });
    const rows = records ?? [];
    sportsTestQuarterCount = rows.length;
    sportsTest = {
      quarters: rows.map((r) => ({
        fiscalYear: r.fiscal_year,
        quarter: r.quarter,
        values: Object.fromEntries(
          SPORTS_TEST_RANKING_METRICS.map((m) => [
            m.value,
            { label: m.label, value: m.extract(r), unit: m.unit, direction: m.direction },
          ]),
        ),
      })),
    };
  }

  const practiceSchedules = await fetchPracticeSchedulesInYear(supabase, fiscalYear);
  const practiceIds = practiceSchedules.map((s) => s.id);
  let statuses: string[] = [];
  let menus: PracticeMenuSummary[] = [];
  if (practiceIds.length > 0) {
    const [{ data: attendanceRows }, { data: menuRows }] = await Promise.all([
      supabase.from("attendances").select("schedule_id, status").eq("player_id", playerId).in("schedule_id", practiceIds),
      supabase.from("practice_menus").select("*").in("schedule_id", practiceIds),
    ]);
    statuses = (attendanceRows ?? []).map((a) => a.status);
    const attendedScheduleIds = new Set(
      (attendanceRows ?? []).filter((a) => a.status === "出席" || a.status === "遅刻早退").map((a) => a.schedule_id),
    );
    const themeCount = new Map<string, { implemented: number; held: number }>();
    (menuRows ?? []).forEach((m) => {
      const theme = (m.theme ?? "").trim();
      if (!theme) return;
      const cur = themeCount.get(theme) ?? { implemented: 0, held: 0 };
      cur.held += 1;
      if (attendedScheduleIds.has(m.schedule_id)) cur.implemented += 1;
      themeCount.set(theme, cur);
    });
    menus = Array.from(themeCount.entries())
      .map(([name, { implemented, held }]) => ({
        name,
        implementedCount: implemented,
        practicesHeld: held,
        implementationRate: held > 0 ? Math.round((implemented / held) * 1000) / 10 : null,
      }))
      .sort((a, b) => b.implementedCount - a.implementedCount);
  }
  const practice = practiceParticipation(practiceSchedules.length, statuses);

  const { data: growthRows } = await supabase
    .from("player_growth_records")
    .select("*")
    .eq("player_id", playerId)
    .order("measured_on", { ascending: false })
    .limit(8);
  const growth = (growthRows ?? [])
    .map((g) => ({ date: g.measured_on, heightCm: g.height_cm, weightKg: g.weight_kg }))
    .reverse();

  const dataQuality = assessPlayerDataQuality({
    gameCount,
    sportsTestQuarterCount,
    practicesHeld: practiceSchedules.length,
    growthPointCount: growth.length,
  });

  return {
    sport,
    planKind,
    fiscalYear,
    player: {
      name: playerFullName(player),
      grade: gradeLabel(player.grade),
      positions: player.positions,
      status: player.status,
    },
    stats,
    sportsTest,
    practice,
    menus,
    growth,
    dataQuality,
  };
}

// ============ チーム分析 ============

function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function collectTeamAnalysisData(
  supabase: DB,
  params: { fiscalYear: number; sport: Database["public"]["Tables"]["teams"]["Row"]["sport"]; planKind: AiPlanKind },
): Promise<TeamAnalysisData> {
  const { fiscalYear, sport, planKind } = params;
  const players = await fetchActivePlayers(supabase);
  const rosterCount = players.length;
  const basketball = usesDetailedBasketballStats(sport);
  const includeThreePoint = sport === "バスケットボール";

  let stats: StatsData;
  let gameCount: number;
  if (basketball) {
    const { data: lines } = await supabase
      .from("game_player_stat_lines")
      .select("*, game_matches(opponent, schedules(date, fiscal_year_override))")
      .returns<StatLineWithDate[]>();
    const seasonLines = (lines ?? []).filter((l) => {
      const date = l.game_matches?.schedules?.date;
      if (!date) return false;
      return effectiveFiscalYear(date, l.game_matches?.schedules?.fiscal_year_override ?? null) === fiscalYear;
    });
    const playerAverages = players.map((p) => computeSeasonAverages(seasonLines.filter((l) => l.player_id === p.id)));
    const teamAverages = computeTeamAverages(playerAverages, seasonLines);
    gameCount = teamAverages.gp;
    stats = {
      kind: "basketball",
      gameCount,
      seasonAverages: basketballAveragesToRecord(teamAverages, includeThreePoint),
      games: [],
    };
  } else {
    const [{ data: categories }, { data: entries }] = await Promise.all([
      supabase.from("team_stat_categories").select("*").order("position", { ascending: true }),
      supabase
        .from("game_player_stat_entries")
        .select("*, game_matches(opponent, schedules(date, fiscal_year_override))")
        .returns<StatEntryWithDate[]>(),
    ]);
    const cats = categories ?? [];
    const seasonEntries = (entries ?? []).filter((e) => {
      const date = e.game_matches?.schedules?.date;
      if (!date) return false;
      return effectiveFiscalYear(date, e.game_matches?.schedules?.fiscal_year_override ?? null) === fiscalYear;
    });
    const playerAverages = players.map((p) => computeCustomSeasonAverages(seasonEntries.filter((e) => e.player_id === p.id), cats));
    const played = playerAverages.filter((a) => a.gp > 0);
    gameCount = played.length > 0 ? Math.max(...played.map((a) => a.gp)) : 0;
    const categoryInfos: CustomStatCategoryInfo[] = cats.map((c) => {
      const avg =
        played.length > 0 ? played.reduce((sum, a) => sum + (a.averages[c.id] ?? 0), 0) / played.length : 0;
      const total = played.reduce((sum, a) => sum + (a.totals[c.id] ?? 0), 0);
      return {
        name: c.name,
        unit: c.unit,
        description: c.description,
        evaluationDirection: c.evaluation_direction,
        seasonTotal: Math.round(total * 10) / 10,
        seasonAverage: Math.round(avg * 10) / 10,
      };
    });
    stats = { kind: "custom", gameCount, categories: categoryInfos, games: [] };
  }

  let sportsTest: TeamSportsTestData | null = null;
  let sportsTestMeasuredRatio: number | null = null;
  if (planKind === "max") {
    const { data: records } = await supabase
      .from("sports_test_records")
      .select("*")
      .eq("not_conducted", false)
      .order("fiscal_year", { ascending: true })
      .order("quarter", { ascending: true });
    const rows = records ?? [];
    const byQuarterKey = new Map<string, SportsTestRecord[]>();
    rows.forEach((r) => {
      const key = `${r.fiscal_year}-${r.quarter}`;
      const arr = byQuarterKey.get(key) ?? [];
      arr.push(r);
      byQuarterKey.set(key, arr);
    });
    const sortedKeys = Array.from(byQuarterKey.keys()).sort((a, b) => {
      const [ay, aq] = a.split("-").map(Number);
      const [by, bq] = b.split("-").map(Number);
      return ay !== by ? ay - by : aq - bq;
    });
    const quarters = sortedKeys.map((key, idx) => {
      const [fy, q] = key.split("-").map(Number);
      const current = byQuarterKey.get(key)!;
      const previous = idx > 0 ? byQuarterKey.get(sortedKeys[idx - 1])! : null;
      const metrics: Record<string, TeamSportsTestMetricSummary> = {};
      SPORTS_TEST_RANKING_METRICS.forEach((m) => {
        const values = current.map((r) => ({ playerId: r.player_id, value: m.extract(r) })).filter((v) => v.value !== null) as {
          playerId: string;
          value: number;
        }[];
        const nums = values.map((v) => v.value);
        let improved: number | null = null;
        let maintained: number | null = null;
        let declined: number | null = null;
        if (previous) {
          improved = 0;
          maintained = 0;
          declined = 0;
          values.forEach((v) => {
            const prevRecord = previous.find((r) => r.player_id === v.playerId);
            if (!prevRecord) return;
            const prevValue = m.extract(prevRecord);
            if (prevValue === null) return;
            const better = m.direction === "asc" ? v.value < prevValue : v.value > prevValue;
            const same = v.value === prevValue;
            if (same) maintained!++;
            else if (better) improved!++;
            else declined!++;
          });
        }
        metrics[m.value] = {
          label: m.label,
          unit: m.unit,
          direction: m.direction,
          measuredCount: nums.length,
          average: nums.length > 0 ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null,
          median: medianOf(nums),
          improvedCount: improved,
          maintainedCount: maintained,
          declinedCount: declined,
        };
      });
      return {
        fiscalYear: fy,
        quarter: q,
        measuredPlayerCount: new Set(current.map((r) => r.player_id)).size,
        rosterCount,
        metrics,
      };
    });
    sportsTest = { quarters };
    const latest = quarters[quarters.length - 1];
    sportsTestMeasuredRatio = latest && rosterCount > 0 ? latest.measuredPlayerCount / rosterCount : null;
  }

  const practiceSchedules = await fetchPracticeSchedulesInYear(supabase, fiscalYear);
  const practiceIds = practiceSchedules.map((s) => s.id);
  let perPlayerRates: number[] = [];
  let menus: PracticeMenuSummary[] = [];
  if (practiceIds.length > 0) {
    const [{ data: attendanceRows }, { data: menuRows }] = await Promise.all([
      supabase.from("attendances").select("schedule_id, player_id, status").in("schedule_id", practiceIds).not("player_id", "is", null),
      supabase.from("practice_menus").select("*").in("schedule_id", practiceIds),
    ]);
    const rows = attendanceRows ?? [];
    perPlayerRates = players.map((p) => {
      const statuses = rows.filter((a) => a.player_id === p.id).map((a) => a.status);
      const summary = practiceParticipation(practiceSchedules.length, statuses);
      return summary.participationRate ?? 0;
    });
    const themeCount = new Map<string, number>();
    (menuRows ?? []).forEach((m) => {
      const theme = (m.theme ?? "").trim();
      if (!theme) return;
      themeCount.set(theme, (themeCount.get(theme) ?? 0) + 1);
    });
    menus = Array.from(themeCount.entries())
      .map(([name, count]) => ({
        name,
        implementedCount: count,
        practicesHeld: practiceSchedules.length,
        implementationRate: practiceSchedules.length > 0 ? Math.round((count / practiceSchedules.length) * 1000) / 10 : null,
      }))
      .sort((a, b) => b.implementedCount - a.implementedCount);
  }
  const practice: TeamPracticeParticipationSummary = {
    practicesHeld: practiceSchedules.length,
    averageRate:
      perPlayerRates.length > 0
        ? Math.round((perPlayerRates.reduce((a, b) => a + b, 0) / perPlayerRates.length) * 10) / 10
        : null,
    medianRate: medianOf(perPlayerRates),
    highParticipantCount: perPlayerRates.filter((r) => r >= 80).length,
    lowParticipantCount: perPlayerRates.filter((r) => r < 50).length,
    rosterCount,
  };

  const dataQuality = assessTeamDataQuality({
    rosterCount,
    gameCount,
    sportsTestMeasuredRatio,
    practicesHeld: practiceSchedules.length,
  });

  return { sport, planKind, fiscalYear, playerCount: rosterCount, stats, sportsTest, practice, menus, dataQuality };
}
