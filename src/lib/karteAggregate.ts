import type { GamePlayerStatEntry, GamePlayerStatLine, SportsTestRecord, TeamStatCategory } from "@/lib/database.types";

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
  // fg_made/fg_attは2P+3P合算のため、2P%はその内訳(fg-three)として算出する。
  // バスケットボール(3ポイントあり)チームでのみ意味を持つ(ミニバスケは常にthreeAtt=0)。
  twoPct: number | null;
  threePct: number | null;
  twoMadeTotal: number;
  twoAttTotal: number;
  threeMadeTotal: number;
  threeAttTotal: number;
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

// バスケットボール(usesThreePointScoring(sport)がtrue)のチームだけ、GAME_COLUMNSに
// 追加で連結して表示する列。
export const THREE_POINT_GAME_COLUMNS: { key: keyof SeasonStatAverages; abbr: string }[] = [
  { key: "twoPct", abbr: "2P%" },
  { key: "threePct", abbr: "3P%" },
];

export interface GameStatCellParts {
  primary: string;
  // FG/FTだけは分母(試投数)も併記するため、成功率の下に「成功数/試投数」を2段目として持たせる。
  secondary?: string;
}

export function gameStatCellParts(key: keyof SeasonStatAverages, a: SeasonStatAverages): GameStatCellParts {
  if (key === "fgPct" || key === "ftPct" || key === "twoPct" || key === "threePct") {
    const madeTotal =
      key === "fgPct"
        ? a.fgMadeTotal
        : key === "ftPct"
          ? a.ftMadeTotal
          : key === "twoPct"
            ? a.twoMadeTotal
            : a.threeMadeTotal;
    const attTotal =
      key === "fgPct"
        ? a.fgAttTotal
        : key === "ftPct"
          ? a.ftAttTotal
          : key === "twoPct"
            ? a.twoAttTotal
            : a.threeAttTotal;
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
      twoPct: null,
      threePct: null,
      twoMadeTotal: 0,
      twoAttTotal: 0,
      threeMadeTotal: 0,
      threeAttTotal: 0,
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
      threeMade: acc.threeMade + l.three_made,
      threeAtt: acc.threeAtt + l.three_att,
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
      threeMade: 0,
      threeAtt: 0,
      ftMade: 0,
      ftAtt: 0,
    },
  );
  const twoMade = sum.fgMade - sum.threeMade;
  const twoAtt = sum.fgAtt - sum.threeAtt;
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
    twoPct: twoAtt > 0 ? round1((twoMade / twoAtt) * 100) : null,
    threePct: sum.threeAtt > 0 ? round1((sum.threeMade / sum.threeAtt) * 100) : null,
    twoMadeTotal: twoMade,
    twoAttTotal: twoAtt,
    threeMadeTotal: sum.threeMade,
    threeAttTotal: sum.threeAtt,
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
      threeMade: acc.threeMade + l.three_made,
      threeAtt: acc.threeAtt + l.three_att,
      ftMade: acc.ftMade + l.ft_made,
      ftAtt: acc.ftAtt + l.ft_att,
    }),
    { fgMade: 0, fgAtt: 0, threeMade: 0, threeAtt: 0, ftMade: 0, ftAtt: 0 },
  );
  const twoMade = totals.fgMade - totals.threeMade;
  const twoAtt = totals.fgAtt - totals.threeAtt;

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
    twoPct: twoAtt > 0 ? round1((twoMade / twoAtt) * 100) : null,
    threePct: totals.threeAtt > 0 ? round1((totals.threeMade / totals.threeAtt) * 100) : null,
    twoMadeTotal: twoMade,
    twoAttTotal: twoAtt,
    threeMadeTotal: totals.threeMade,
    threeAttTotal: totals.threeAtt,
  };
}

// ここから下は、バスケットボール・ミニバスケットボール以外の競技向けの
// カスタムスタッツ(チームが自由に定義する項目)の集計。上のGAME_COLUMNS/
// computeSeasonAverages/computeTeamAveragesとは別の、汎用的な集計ロジック。

export interface CustomStatSeasonAverages {
  gp: number;
  totals: Record<string, number>;
  averages: Record<string, number>;
}

// 出場した試合(この選手のエントリが1件でもある試合)だけをGPとして数える
// (computeSeasonAveragesと同じ考え方)。
export function computeCustomSeasonAverages(
  entries: GamePlayerStatEntry[],
  categories: TeamStatCategory[],
): CustomStatSeasonAverages {
  const gp = new Set(entries.map((e) => e.match_id)).size;
  const totals: Record<string, number> = {};
  categories.forEach((c) => {
    totals[c.id] = round1(entries.filter((e) => e.category_id === c.id).reduce((sum, e) => sum + e.value, 0));
  });
  const averages: Record<string, number> = {};
  categories.forEach((c) => {
    averages[c.id] = gp > 0 ? round1(totals[c.id] / gp) : 0;
  });
  return { gp, totals, averages };
}

// 元のバスケ用computeTeamAveragesと同じく、出場した各選手の個人平均をそのまま単純平均する
// (試合数の重み付けはしない)。
export function computeCustomTeamAverages(
  playerAverages: CustomStatSeasonAverages[],
  categories: TeamStatCategory[],
): CustomStatSeasonAverages {
  const played = playerAverages.filter((a) => a.gp > 0);
  const n = played.length;
  const averages: Record<string, number> = {};
  const totals: Record<string, number> = {};
  categories.forEach((c) => {
    // totalsはチーム合計(出場選手の個人合計を足し上げたもの)、averagesは個人平均の単純平均。
    totals[c.id] = round1(played.reduce((sum, a) => sum + (a.totals[c.id] ?? 0), 0));
    averages[c.id] = n > 0 ? round1(played.reduce((sum, a) => sum + (a.averages[c.id] ?? 0), 0) / n) : 0;
  });
  return { gp: n, totals, averages };
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

// aiEvaluationDirection/aiMeasuredQualityはAI分析(src/lib/ai/)がスポーツテストの
// 数値を解釈する際に使う。direction(asc/desc)はランキング機能向けに既存定義されている
// 「良い記録の向き」をそのまま転用したもの(推測ではない)。ただしウイングスパンは
// 能力の指標ではなく身体測定値のため、AI向けにはNEUTRAL(良し悪しを評価しない)とする。
// aiMeasuredQualityは、テスト名から自明な範囲の「何を測っているか」の一般的な説明に留め、
// 特定の競技動作・プレースキルへの言い換えはしない(それはAI側のプロンプトルールで禁止する)。
export const SPORTS_TEST_RANKING_METRICS: {
  value: SportsTestMetric;
  label: string;
  abbrLines: [string, string];
  unit: string;
  direction: "asc" | "desc";
  aiEvaluationDirection: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | "NEUTRAL";
  aiMeasuredQuality: string;
  extract: (r: SportsTestRecord) => number | null;
}[] = [
  {
    value: "wingspan_cm",
    label: "ウイングスパン",
    abbrLines: ["ウイング", "スパン"],
    unit: "cm",
    direction: "desc",
    aiEvaluationDirection: "NEUTRAL",
    aiMeasuredQuality: "身体測定値(発育の指標であり、能力の高低として評価しない)",
    extract: (r) => r.wingspan_cm,
  },
  {
    value: "sprint20m",
    label: "20mスプリント",
    abbrLines: ["20mス", "プリント"],
    unit: "秒",
    direction: "asc",
    aiEvaluationDirection: "LOWER_IS_BETTER",
    aiMeasuredQuality: "直線的な走力(スプリント速度)",
    extract: (r) => bestOf(r.sprint20m_1, r.sprint20m_2, "asc"),
  },
  {
    value: "lane_agility",
    label: "レーンアジリティ",
    abbrLines: ["レーンア", "ジリティ"],
    unit: "秒",
    direction: "asc",
    aiEvaluationDirection: "LOWER_IS_BETTER",
    aiMeasuredQuality: "方向転換を伴う敏捷性",
    extract: (r) => bestOf(r.lane_agility_1, r.lane_agility_2, "asc"),
  },
  {
    value: "side_step",
    label: "反復横跳び",
    abbrLines: ["反復横", "跳び"],
    unit: "点",
    direction: "desc",
    aiEvaluationDirection: "HIGHER_IS_BETTER",
    aiMeasuredQuality: "左右方向への敏捷性",
    extract: (r) => bestOf(r.side_step_1, r.side_step_2, "desc"),
  },
  {
    value: "shuttle_20m_x3",
    label: "20m三往復",
    abbrLines: ["20m", "三往復"],
    unit: "秒",
    direction: "asc",
    aiEvaluationDirection: "LOWER_IS_BETTER",
    aiMeasuredQuality: "反復的なスプリント能力",
    extract: (r) => r.shuttle_20m_x3,
  },
  {
    value: "long_jump",
    label: "立ち幅跳び",
    abbrLines: ["立ち幅", "跳び"],
    unit: "cm",
    direction: "desc",
    aiEvaluationDirection: "HIGHER_IS_BETTER",
    aiMeasuredQuality: "下肢の瞬発的なパワー",
    extract: (r) => bestOf(r.long_jump_1, r.long_jump_2, "desc"),
  },
  {
    value: "ball_throw",
    label: "ボール投げ",
    abbrLines: ["ボール", "投げ"],
    unit: "m",
    direction: "desc",
    aiEvaluationDirection: "HIGHER_IS_BETTER",
    aiMeasuredQuality: "投動作に関わる出力(パワー)",
    extract: (r) => bestOf(r.ball_throw_1, r.ball_throw_2, "desc"),
  },
  {
    value: "back_fist_right",
    label: "背中こぶし合わせ(右上)",
    abbrLines: ["背中", "右上"],
    unit: "cm",
    direction: "asc",
    aiEvaluationDirection: "LOWER_IS_BETTER",
    aiMeasuredQuality: "肩関節まわりの柔軟性(0cmに近いほど両手が触れ合っている)",
    extract: (r) => r.back_fist_right,
  },
  {
    value: "back_fist_left",
    label: "背中こぶし合わせ(左上)",
    abbrLines: ["背中", "左上"],
    unit: "cm",
    direction: "asc",
    aiEvaluationDirection: "LOWER_IS_BETTER",
    aiMeasuredQuality: "肩関節まわりの柔軟性(0cmに近いほど両手が触れ合っている)",
    extract: (r) => r.back_fist_left,
  },
  {
    value: "ft_golf",
    label: "FTゴルフ",
    abbrLines: ["FT", "ゴルフ"],
    unit: "/10",
    direction: "desc",
    aiEvaluationDirection: "HIGHER_IS_BETTER",
    aiMeasuredQuality: "フリースロー動作の成功率(試行数10本と少ないため断定は弱めること)",
    extract: (r) => r.ft_golf,
  },
  {
    value: "beep_test_reps",
    label: "20mシャトルラン",
    abbrLines: ["20シャ", "トルラン"],
    unit: "回",
    direction: "desc",
    aiEvaluationDirection: "HIGHER_IS_BETTER",
    aiMeasuredQuality: "心肺持久力",
    extract: (r) => r.beep_test_reps,
  },
];

