import type { GamePlayerStatLine, Player, PlayerGrowthRecord, SportsTestRecord } from "@/lib/database.types";
import { fiscalYearLabel, formatDateLabel, gradeLabel, playerFullName } from "@/lib/format";

export interface SeasonStatAverages {
  gp: number;
  pts: number;
  fgMade: number;
  ftMade: number;
  reb: number;
  rebOff: number;
  rebDef: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fouls: number;
  eff: number;
  fgPct: number | null;
  ftPct: number | null;
  fgMadeTotal: number;
  fgAttTotal: number;
  ftMadeTotal: number;
  ftAttTotal: number;
}

// 得点・FG成功率・FT成功率・アシスト・OFリバウンド・DFリバウンド・スティール・ブロック・
// ターンオーバー・EFFの順。チームカルテ・選手カルテの表で共通して使う列定義。
export const GAME_COLUMNS: { key: keyof SeasonStatAverages; abbr: string }[] = [
  { key: "pts", abbr: "PTS" },
  { key: "fgPct", abbr: "FG%" },
  { key: "ftPct", abbr: "FT%" },
  { key: "ast", abbr: "AST" },
  { key: "rebOff", abbr: "OREB" },
  { key: "rebDef", abbr: "DREB" },
  { key: "stl", abbr: "STL" },
  { key: "blk", abbr: "BLK" },
  { key: "tov", abbr: "TO" },
  { key: "eff", abbr: "EFF" },
];

export interface GameStatCellParts {
  primary: string;
  // FG/FTだけは分母(試投数)も併記するため、成功率の下に「成功数/試投数」を2段目として持たせる。
  secondary?: string;
}

export function gameStatCellParts(key: keyof SeasonStatAverages, a: SeasonStatAverages): GameStatCellParts {
  if (key === "fgPct" || key === "ftPct") {
    const madeTotal = key === "fgPct" ? a.fgMadeTotal : a.ftMadeTotal;
    const attTotal = key === "fgPct" ? a.fgAttTotal : a.ftAttTotal;
    const pct = a[key];
    if (attTotal === 0 || pct === null) return { primary: "-" };
    return { primary: `${pct}%`, secondary: `${madeTotal}/${attTotal}` };
  }
  const v = a[key] as number | null;
  return { primary: v === null ? "-" : `${v}` };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// 出場した試合(この選手のstat_lineが1行でも存在する試合)だけをGPとして数える。
export function computeSeasonAverages(lines: GamePlayerStatLine[]): SeasonStatAverages {
  const gp = lines.length;
  if (gp === 0) {
    return {
      gp: 0,
      pts: 0,
      fgMade: 0,
      ftMade: 0,
      reb: 0,
      rebOff: 0,
      rebDef: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      fouls: 0,
      eff: 0,
      fgPct: null,
      ftPct: null,
      fgMadeTotal: 0,
      fgAttTotal: 0,
      ftMadeTotal: 0,
      ftAttTotal: 0,
    };
  }
  const sum = lines.reduce(
    (acc, l) => ({
      pts: acc.pts + l.pts,
      reb: acc.reb + l.reb,
      rebOff: acc.rebOff + l.reb_off,
      rebDef: acc.rebDef + l.reb_def,
      ast: acc.ast + l.ast,
      stl: acc.stl + l.stl,
      blk: acc.blk + l.blk,
      tov: acc.tov + l.tov,
      fouls: acc.fouls + l.fouls,
      eff: acc.eff + l.eff,
      fgMade: acc.fgMade + l.fg_made,
      fgAtt: acc.fgAtt + l.fg_att,
      ftMade: acc.ftMade + l.ft_made,
      ftAtt: acc.ftAtt + l.ft_att,
    }),
    {
      pts: 0,
      reb: 0,
      rebOff: 0,
      rebDef: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      fouls: 0,
      eff: 0,
      fgMade: 0,
      fgAtt: 0,
      ftMade: 0,
      ftAtt: 0,
    },
  );
  return {
    gp,
    pts: round1(sum.pts / gp),
    fgMade: round1(sum.fgMade / gp),
    ftMade: round1(sum.ftMade / gp),
    reb: round1(sum.reb / gp),
    rebOff: round1(sum.rebOff / gp),
    rebDef: round1(sum.rebDef / gp),
    ast: round1(sum.ast / gp),
    stl: round1(sum.stl / gp),
    blk: round1(sum.blk / gp),
    tov: round1(sum.tov / gp),
    fouls: round1(sum.fouls / gp),
    eff: round1(sum.eff / gp),
    fgPct: sum.fgAtt > 0 ? round1((sum.fgMade / sum.fgAtt) * 100) : null,
    ftPct: sum.ftAtt > 0 ? round1((sum.ftMade / sum.ftAtt) * 100) : null,
    fgMadeTotal: sum.fgMade,
    fgAttTotal: sum.fgAtt,
    ftMadeTotal: sum.ftMade,
    ftAttTotal: sum.ftAtt,
  };
}

// 元のExcelの「チーム平均」に合わせ、カウント系のスタッツ(得点・リバウンド等)は
// 出場した各選手の個人平均をそのまま単純平均する(試合数の重み付けはしない)。
// FG%/FT%だけは全選手・全試合の成功数/試投数を合算した実際の割合を使う
// (個人の割合を単純平均すると試投数の少ない選手の影響が過大になるため)。
export function computeTeamAverages(
  playerAverages: SeasonStatAverages[],
  lines: GamePlayerStatLine[],
): SeasonStatAverages {
  const played = playerAverages.filter((a) => a.gp > 0);
  const n = played.length;
  const mean = (key: keyof SeasonStatAverages) =>
    n > 0 ? round1(played.reduce((sum, a) => sum + (a[key] as number), 0) / n) : 0;

  const totals = lines.reduce(
    (acc, l) => ({
      fgMade: acc.fgMade + l.fg_made,
      fgAtt: acc.fgAtt + l.fg_att,
      ftMade: acc.ftMade + l.ft_made,
      ftAtt: acc.ftAtt + l.ft_att,
    }),
    { fgMade: 0, fgAtt: 0, ftMade: 0, ftAtt: 0 },
  );

  return {
    gp: n,
    pts: mean("pts"),
    fgMade: mean("fgMade"),
    ftMade: mean("ftMade"),
    reb: mean("reb"),
    rebOff: mean("rebOff"),
    rebDef: mean("rebDef"),
    ast: mean("ast"),
    stl: mean("stl"),
    blk: mean("blk"),
    tov: mean("tov"),
    fouls: mean("fouls"),
    eff: mean("eff"),
    fgPct: totals.fgAtt > 0 ? round1((totals.fgMade / totals.fgAtt) * 100) : null,
    ftPct: totals.ftAtt > 0 ? round1((totals.ftMade / totals.ftAtt) * 100) : null,
    fgMadeTotal: totals.fgMade,
    fgAttTotal: totals.fgAtt,
    ftMadeTotal: totals.ftMade,
    ftAttTotal: totals.ftAtt,
  };
}

export type RankingMetric = "pts" | "reb" | "ast" | "stl" | "blk" | "eff" | "fgPct" | "ftPct";

export const RANKING_METRICS: { value: RankingMetric; label: string; unit: string }[] = [
  { value: "pts", label: "得点(PTS)", unit: "点" },
  { value: "reb", label: "リバウンド(REB)", unit: "本" },
  { value: "ast", label: "アシスト(AST)", unit: "本" },
  { value: "stl", label: "スティール(STL)", unit: "本" },
  { value: "blk", label: "ブロック(BLK)", unit: "本" },
  { value: "eff", label: "EFF", unit: "" },
  { value: "fgPct", label: "FG成功率", unit: "%" },
  { value: "ftPct", label: "FT成功率", unit: "%" },
];

// スポーツテストは項目ごとに「速い/遠い/多いほど良い」の向きが違うため、
// 項目ごとにdirection(asc=小さいほど良い, desc=大きいほど良い)を持たせる。
// ①②の2回計測がある項目は、そのうち良い方の記録をランキング対象にする。
export type SportsTestMetric =
  | "wingspan_cm"
  | "sprint20m"
  | "long_jump"
  | "lane_agility"
  | "side_step"
  | "shuttle_20m_x3"
  | "ball_throw"
  | "back_fist_right"
  | "back_fist_left"
  | "ft_golf"
  | "beep_test_reps";

function bestOf(v1: number | null, v2: number | null, direction: "asc" | "desc"): number | null {
  const vals = [v1, v2].filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  return direction === "asc" ? Math.min(...vals) : Math.max(...vals);
}

export const SPORTS_TEST_RANKING_METRICS: {
  value: SportsTestMetric;
  label: string;
  abbrLines: [string, string];
  unit: string;
  direction: "asc" | "desc";
  extract: (r: SportsTestRecord) => number | null;
}[] = [
  {
    value: "wingspan_cm",
    label: "ウイングスパン",
    abbrLines: ["ウイング", "スパン"],
    unit: "cm",
    direction: "desc",
    extract: (r) => r.wingspan_cm,
  },
  {
    value: "sprint20m",
    label: "20mスプリント",
    abbrLines: ["20mス", "プリント"],
    unit: "秒",
    direction: "asc",
    extract: (r) => bestOf(r.sprint20m_1, r.sprint20m_2, "asc"),
  },
  {
    value: "lane_agility",
    label: "レーンアジリティ",
    abbrLines: ["レーンア", "ジリティ"],
    unit: "秒",
    direction: "asc",
    extract: (r) => bestOf(r.lane_agility_1, r.lane_agility_2, "asc"),
  },
  {
    value: "side_step",
    label: "反復横跳び",
    abbrLines: ["反復横", "跳び"],
    unit: "点",
    direction: "desc",
    extract: (r) => bestOf(r.side_step_1, r.side_step_2, "desc"),
  },
  {
    value: "shuttle_20m_x3",
    label: "20m三往復",
    abbrLines: ["20m", "三往復"],
    unit: "秒",
    direction: "asc",
    extract: (r) => r.shuttle_20m_x3,
  },
  {
    value: "long_jump",
    label: "立ち幅跳び",
    abbrLines: ["立ち幅", "跳び"],
    unit: "cm",
    direction: "desc",
    extract: (r) => bestOf(r.long_jump_1, r.long_jump_2, "desc"),
  },
  {
    value: "ball_throw",
    label: "ボール投げ",
    abbrLines: ["ボール", "投げ"],
    unit: "m",
    direction: "desc",
    extract: (r) => bestOf(r.ball_throw_1, r.ball_throw_2, "desc"),
  },
  {
    value: "back_fist_right",
    label: "背中こぶし合わせ(右上)",
    abbrLines: ["背中", "右上"],
    unit: "cm",
    direction: "asc",
    extract: (r) => r.back_fist_right,
  },
  {
    value: "back_fist_left",
    label: "背中こぶし合わせ(左上)",
    abbrLines: ["背中", "左上"],
    unit: "cm",
    direction: "asc",
    extract: (r) => r.back_fist_left,
  },
  {
    value: "ft_golf",
    label: "FTゴルフ",
    abbrLines: ["FT", "ゴルフ"],
    unit: "/10",
    direction: "desc",
    extract: (r) => r.ft_golf,
  },
  {
    value: "beep_test_reps",
    label: "20mシャトルラン",
    abbrLines: ["20シャ", "トルラン"],
    unit: "回",
    direction: "desc",
    extract: (r) => r.beep_test_reps,
  },
];

const ANALYSIS_QUARTERS = [1, 2, 3, 4] as const;

export const DEFAULT_KARTE_ANALYSIS_PROMPT =
  "以下はミニバスケットボール選手(小学生)のスタッツ・スポーツテストのデータです。伸びている点と今後の課題を分析し、簡潔に示してください。";

export interface PlayerKarteBodyParams {
  player: Player;
  fiscalYear: number;
  seasonAverages: SeasonStatAverages;
  gameRows: { label: string; averages: SeasonStatAverages }[];
  sportsTestRecords: SportsTestRecord[];
  growthRecords: PlayerGrowthRecord[];
  workoutTallies: { theme: string; count: number }[];
  attendedPracticeCount: number;
}

// 選手1人分の「■ 選手情報」以下のセクションを組み立てる。個人用・一括用のどちらからも使う。
function formatPlayerKarteBody(params: PlayerKarteBodyParams): string[] {
  const { player, fiscalYear, seasonAverages, gameRows, sportsTestRecords, growthRecords, workoutTallies, attendedPracticeCount } =
    params;
  const lines: string[] = [];

  lines.push("■ 選手情報");
  lines.push(`氏名: ${playerFullName(player)}`);
  lines.push(`学年: ${gradeLabel(player.grade)}`);
  lines.push(`ポジション: ${player.positions.join("/") || "-"}`);
  lines.push(`対象年度: ${fiscalYearLabel(fiscalYear)}`);
  lines.push("");

  lines.push(`■ シーズン平均スタッツ(試合数: ${seasonAverages.gp})`);
  if (seasonAverages.gp === 0) {
    lines.push("この年度の出場記録はありません");
  } else {
    GAME_COLUMNS.forEach((c) => {
      const parts = gameStatCellParts(c.key, seasonAverages);
      lines.push(`${c.abbr}: ${parts.primary}${parts.secondary ? `(${parts.secondary})` : ""}`);
    });
  }
  lines.push("");

  lines.push("■ 試合ごとの記録");
  if (gameRows.length === 0) {
    lines.push("記録なし");
  } else {
    gameRows.forEach((row) => {
      const summary = GAME_COLUMNS.map((c) => {
        const parts = gameStatCellParts(c.key, row.averages);
        return `${c.abbr} ${parts.primary}`;
      }).join(" / ");
      lines.push(`${row.label}: ${summary}`);
    });
  }
  lines.push("");

  lines.push("■ スポーツテスト(四半期ごと)");
  let anyTest = false;
  ANALYSIS_QUARTERS.forEach((q) => {
    const record = sportsTestRecords.find((r) => r.quarter === q);
    if (!record || record.not_conducted) return;
    anyTest = true;
    const values = SPORTS_TEST_RANKING_METRICS.map((m) => {
      const v = m.extract(record);
      return `${m.label} ${v === null ? "-" : `${v}${m.unit}`}`;
    }).join(" / ");
    lines.push(`Q${q}: ${values}`);
  });
  if (!anyTest) lines.push("記録なし");
  lines.push("");

  // 「このワークアウトをこれだけこなした」を出欠(出席・遅刻早退。見学・欠席は除く)に基づいて
  // 把握できるように、出席・遅刻早退した練習に紐づく実施メニューだけをテーマごとに集計する。
  lines.push(`■ 実施したワークアウト(出席・遅刻早退した練習: ${attendedPracticeCount}回)`);
  if (workoutTallies.length === 0) {
    lines.push("記録なし");
  } else {
    workoutTallies.forEach((t) => lines.push(`${t.theme}: ${t.count}回`));
  }
  lines.push("");

  lines.push("■ 身長・体重(直近)");
  if (growthRecords.length === 0) {
    lines.push("記録なし");
  } else {
    growthRecords.forEach((g) => {
      lines.push(`${formatDateLabel(g.measured_on)}: ${g.height_cm ?? "-"}cm / ${g.weight_kg ?? "-"}kg`);
    });
  }

  return lines;
}

// 選手カルテの数値を、外部のAIチャットに貼り付けて分析してもらうためのプレーンテキストに整形する。
// アプリ内ではAI APIを呼び出さず、手元のAIツールへのコピペ用テキストを作るだけに留める。
export function buildKarteAnalysisText(
  params: PlayerKarteBodyParams & { promptText: string },
): string {
  const lines = [params.promptText.trim() || DEFAULT_KARTE_ANALYSIS_PROMPT, "", ...formatPlayerKarteBody(params)];
  return lines.join("\n");
}

// 在籍選手全員分の分析用テキストを、選手ごとに見出しで区切って1つにまとめる(選手一括抽出用)。
export function buildBulkKarteAnalysisText(params: {
  promptText: string;
  players: PlayerKarteBodyParams[];
}): string {
  const { promptText, players } = params;
  const lines: string[] = [promptText.trim() || DEFAULT_KARTE_ANALYSIS_PROMPT, ""];
  players.forEach((p) => {
    lines.push(`━━━━━━━━━━ ${playerFullName(p.player)} ━━━━━━━━━━`);
    lines.push(...formatPlayerKarteBody(p));
    lines.push("");
  });
  return lines.join("\n").trimEnd();
}

export const DEFAULT_TEAM_KARTE_ANALYSIS_PROMPT =
  "以下はミニバスケットボールチーム全体のスタッツ・スポーツテスト・練習状況のデータです。チームとして伸びている点と今後の課題を分析し、簡潔に示してください。";

// スポーツテストの各項目を、指定した記録群(通常は同じ四半期の全選手分)でチーム平均する。
export function computeSportsTestTeamAverages(
  records: SportsTestRecord[],
): Partial<Record<SportsTestMetric, number | null>> {
  const result: Partial<Record<SportsTestMetric, number | null>> = {};
  SPORTS_TEST_RANKING_METRICS.forEach((m) => {
    const nums = records.map((r) => m.extract(r)).filter((v): v is number => v !== null);
    result[m.value] = nums.length > 0 ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;
  });
  return result;
}

// チーム全体の数値を、外部のAIチャットに貼り付けて分析してもらうためのプレーンテキストに整形する(チーム全体抽出用)。
export function buildTeamKarteAnalysisText(params: {
  promptText: string;
  fiscalYear: number;
  playerCount: number;
  teamAverages: SeasonStatAverages;
  sportsTestQuarterAverages: { quarter: number; averages: Partial<Record<SportsTestMetric, number | null>> }[];
  workoutTallies: { theme: string; count: number }[];
  practicesHeld: number;
  averageAttendanceRate: number | null;
}): string {
  const {
    promptText,
    fiscalYear,
    playerCount,
    teamAverages,
    sportsTestQuarterAverages,
    workoutTallies,
    practicesHeld,
    averageAttendanceRate,
  } = params;
  const lines: string[] = [];

  lines.push(promptText.trim() || DEFAULT_TEAM_KARTE_ANALYSIS_PROMPT);
  lines.push("");
  lines.push("■ チーム情報");
  lines.push(`対象年度: ${fiscalYearLabel(fiscalYear)}`);
  lines.push(`在籍選手数: ${playerCount}名`);
  lines.push("");

  lines.push(`■ チーム平均スタッツ(出場選手ベース、試合数: ${teamAverages.gp})`);
  if (teamAverages.gp === 0) {
    lines.push("この年度の出場記録はありません");
  } else {
    GAME_COLUMNS.forEach((c) => {
      const parts = gameStatCellParts(c.key, teamAverages);
      lines.push(`${c.abbr}: ${parts.primary}${parts.secondary ? `(${parts.secondary})` : ""}`);
    });
  }
  lines.push("");

  lines.push("■ スポーツテスト チーム平均(四半期ごと)");
  if (sportsTestQuarterAverages.length === 0) {
    lines.push("記録なし");
  } else {
    sportsTestQuarterAverages.forEach(({ quarter, averages }) => {
      const values = SPORTS_TEST_RANKING_METRICS.map((m) => {
        const v = averages[m.value];
        return `${m.label} ${v === null || v === undefined ? "-" : `${v}${m.unit}`}`;
      }).join(" / ");
      lines.push(`Q${quarter}: ${values}`);
    });
  }
  lines.push("");

  lines.push(`■ 実施メニュー(年度内、開催練習: ${practicesHeld}回)`);
  if (workoutTallies.length === 0) {
    lines.push("記録なし");
  } else {
    workoutTallies.forEach((t) => lines.push(`${t.theme}: ${t.count}回`));
  }
  lines.push("");

  lines.push("■ 練習参加状況");
  lines.push(`開催練習数: ${practicesHeld}回`);
  lines.push(`在籍選手の平均出席率: ${averageAttendanceRate === null ? "-" : `${averageAttendanceRate}%`}`);

  return lines.join("\n");
}
