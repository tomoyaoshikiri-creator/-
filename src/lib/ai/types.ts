import type { TeamPlan, TeamSport } from "@/lib/database.types";

// AI分析を利用できるプランを2種類の分析内容に正規化する型。hasAiAnalysisAccessで
// trueになるプラン(フルプラス・Max・Max Partner・Signature Edition)をこの2値に
// 正規化する。それ以外のプランではAI分析API自体を呼び出せない(呼び出し元で
// hasAiAnalysisAccessを確認済み)。Max Partner/Signature EditionはMaxと同じ
// 分析内容(スポーツテスト等を含むフル版)を提供するため、新しい値は追加せず
// 既存の"max"に正規化する。
export type AiPlanKind = "proAiPlus" | "max";

export function planKindFor(plan: TeamPlan): AiPlanKind | null {
  if (plan === "フルプラス") return "proAiPlus";
  if (plan === "Max" || plan === "max_partner" || plan === "signature_edition") return "max";
  return null;
}

// バスケットボール・ミニバスケットボール(タップ加算式のGAME_COLUMNS)向けのスタッツ。
export interface BasketballStatsData {
  kind: "basketball";
  gameCount: number;
  seasonAverages: Record<string, number | null>;
  games: { label: string; averages: Record<string, number | null> }[];
}

// バスケットボール・ミニバスケットボール以外(チームが自由に定義するカスタム項目)向け。
// evaluationDirectionが未設定(null)の項目は、AI側で評価方向を勝手に断定しないよう
// プロンプト側で明示する。
//
// aggregationTypeとevaluationDirectionは別の責務であり、SUM+HIGHER_IS_BETTER、
// AVERAGE+NEUTRAL等どの組み合わせもあり得る(片方からもう片方を推測しない)。
//
// seasonTotal/seasonAverageの意味はaggregationTypeにより異なる(欠損は常に0として
// 扱わず、記録が存在するものだけを対象に算出する):
// - SUM: seasonTotal=記録済み全エントリの合計。seasonAverage=記録済み試合(1件以上の
//   記録がある試合)の合計値の平均。
// - AVERAGE / RATE: seasonTotal=null(合計に意味がないため算出しない)。
//   seasonAverage=記録済みエントリ全体の単純平均(RATEは選手ごとの成功数・試行数の
//   内訳がDBにないため、正確なチーム全体の率ではなく参考値)。
// - NEUTRAL / 未設定(null): seasonTotal・seasonAverageともにnull。集計方法が
//   定義されていないため、システム側で合計・平均のどちらかを勝手に決めて算出しない。
export interface CustomStatCategoryInfo {
  name: string;
  unit: string | null;
  description: string | null;
  evaluationDirection: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | "NEUTRAL" | null;
  aggregationType: "SUM" | "AVERAGE" | "RATE" | "NEUTRAL" | null;
  seasonTotal: number | null;
  seasonAverage: number | null;
  recordedEntryCount: number; // このカテゴリで記録された個々のエントリ件数(選手×試合)
  recordedGameCount: number; // このカテゴリの記録が1件以上ある試合数
  recordedPlayerCount: number; // このカテゴリの記録がある選手の人数(team scopeでのみ意味を持つ)
}

// 試合ごとのチーム値。aggregationTypeがSUM/AVERAGE/RATEの項目はvaluesに単一の集計値
// (+記録選手数)を入れる。NEUTRAL・未設定の項目はvaluesに入れず、rawValuesに記録された
// 生の値をそのまま列挙する(自動でチーム合計・平均を作らない)。
export interface CustomStatGameEntry {
  label: string;
  values: Record<string, { value: number; recordedCount: number }>;
  rawValues: Record<string, number[]>;
}

export interface CustomStatsData {
  kind: "custom";
  gameCount: number;
  categories: CustomStatCategoryInfo[];
  games: CustomStatGameEntry[];
}

export type StatsData = BasketballStatsData | CustomStatsData;

// スポーツテスト(Maxプランのみ)。四半期ごとの計測値。
// evaluationDirection/measuredQualityはkarteAggregate.tsのSPORTS_TEST_RANKING_METRICS
// (既存のdirection定義を転用、推測ではない)から引き継ぐ。AIが基準値なしに「得意/苦手」等の
// 絶対評価をしないよう、プロンプト側でこの情報とあわせて明示する。
export interface SportsTestQuarterPoint {
  fiscalYear: number;
  quarter: number;
  values: Record<
    string,
    {
      label: string;
      value: number | null;
      unit: string;
      direction: "asc" | "desc";
      evaluationDirection: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | "NEUTRAL";
      measuredQuality: string;
    }
  >;
}

export interface PlayerSportsTestData {
  quarters: SportsTestQuarterPoint[];
}

export interface TeamSportsTestMetricSummary {
  label: string;
  unit: string;
  direction: "asc" | "desc";
  evaluationDirection: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | "NEUTRAL";
  measuredQuality: string;
  measuredCount: number;
  average: number | null;
  median: number | null;
  improvedCount: number | null; // 前回比較可能な選手のうち改善した人数(nullは前回データなしで算出不可)
  maintainedCount: number | null;
  declinedCount: number | null;
}

export interface TeamSportsTestQuarterSummary {
  fiscalYear: number;
  quarter: number;
  measuredPlayerCount: number;
  rosterCount: number;
  metrics: Record<string, TeamSportsTestMetricSummary>;
}

export interface TeamSportsTestData {
  quarters: TeamSportsTestQuarterSummary[];
}

// 検定(skill_tests / player_skill_test_progress)。スポーツテストとは別概念のため
// SKILL_TEST_DATAとして独立させ、SPORTS_TEST_DATAに混在させない。
// 今回のPLAN_CONTEXT(Pro AI Plus / Max)の分析材料には明記されていないため、
// Phase 1では収集のみ行わずプロンプトにも含めない(範囲外)。

// CLUB LINKは年度途中から利用開始されるチームがあり、運用開始以前の練習は出欠記録
// そのものが存在しないことがある。「記録がない」ことを「参加していない」と誤解しない
// よう、練習参加状況は「年度内全開催数を分母にした値(fullYear〜、参考値)」と
// 「出欠記録がある回だけを分母にした値(recorded〜、実際に記録された範囲での参加状況)」
// の両方を持たせ、加えて出欠データカバー率(attendanceCoverageRate)自体も渡す。
export interface PracticeParticipationSummary {
  practicesHeld: number; // 年度内開催練習数
  attendanceRecordedCount: number; // このうち、出欠記録が1件以上存在する回数
  attendanceCoverageRate: number | null; // attendanceRecordedCount/practicesHeld
  attended: number; // 出席
  late: number; // 遅刻早退
  observed: number; // 見学(通常のトレーニング刺激とは扱わない)
  absent: number; // 欠席
  fullYearParticipationRate: number | null; // (出席+遅刻早退)/開催数。開催0件ならnull
  recordedParticipationRate: number | null; // (出席+遅刻早退)/出欠記録がある回数。記録0件ならnull
}

export interface TeamPracticeParticipationSummary {
  practicesHeld: number; // 年度内開催練習数
  attendanceRecordedSessionCount: number; // このうち、誰か1人でも出欠記録がある回数
  attendanceCoverageRate: number | null; // attendanceRecordedSessionCount/practicesHeld
  fullYearAverageRate: number | null; // 年度内全開催数を分母にした選手ごとの参加率の平均(参考値)
  fullYearMedianRate: number | null;
  recordedAverageRate: number | null; // 出欠記録がある回だけを分母にした選手ごとの参加率の平均(記録がある選手のみ)
  recordedMedianRate: number | null;
  highParticipantCount: number; // recordedベースの参加率80%以上(出欠記録がある選手のみが対象)
  lowParticipantCount: number; // recordedベースの参加率50%未満(出欠記録がある選手のみが対象)
  rosterCount: number;
}

export interface PracticeMenuSummary {
  name: string;
  implementedCount: number;
  practicesHeld: number;
  implementationRate: number | null;
}

export interface GrowthPoint {
  date: string;
  heightCm: number | null;
  weightKg: number | null;
}

export interface DataQualityAssessment {
  confidence: "HIGH" | "MEDIUM" | "LOW";
  // ユーザーには毎回見せないが、確信度が低いほどプロンプト側で断定表現を弱めるよう
  // 明示するための内部メモ。重大な制約がある場合はAI出力の「データ上の注意点」の
  // 材料にもなる。
  notes: string[];
}

export interface PlayerAnalysisData {
  sport: TeamSport;
  planKind: AiPlanKind;
  fiscalYear: number;
  player: {
    name: string;
    grade: string;
    positions: string[];
    status: string;
  };
  stats: StatsData;
  sportsTest: PlayerSportsTestData | null; // proAiPlusでは常にnull
  practice: PracticeParticipationSummary;
  menus: PracticeMenuSummary[];
  growth: GrowthPoint[];
  dataQuality: DataQualityAssessment;
}

export interface TeamAnalysisData {
  sport: TeamSport;
  planKind: AiPlanKind;
  fiscalYear: number;
  playerCount: number;
  stats: StatsData;
  sportsTest: TeamSportsTestData | null; // proAiPlusでは常にnull
  practice: TeamPracticeParticipationSummary;
  menus: PracticeMenuSummary[];
  dataQuality: DataQualityAssessment;
}
