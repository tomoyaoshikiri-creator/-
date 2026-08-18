import type { TeamPlan, TeamSport } from "@/lib/database.types";

// AI分析を利用できる2プランのみを表す型。hasAiAnalysisAccessでtrueになるプラン
// (フルプラス・Max)をこの2値に正規化する。それ以外のプランではAI分析API自体を
// 呼び出せない(呼び出し元でhasAiAnalysisAccessを確認済み)。
export type AiPlanKind = "proAiPlus" | "max";

export function planKindFor(plan: TeamPlan): AiPlanKind | null {
  if (plan === "フルプラス") return "proAiPlus";
  if (plan === "Max") return "max";
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
export interface CustomStatCategoryInfo {
  name: string;
  unit: string | null;
  description: string | null;
  evaluationDirection: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | "NEUTRAL" | null;
  seasonTotal: number;
  seasonAverage: number;
}

export interface CustomStatsData {
  kind: "custom";
  gameCount: number;
  categories: CustomStatCategoryInfo[];
  games: { label: string; values: Record<string, number> }[];
}

export type StatsData = BasketballStatsData | CustomStatsData;

// スポーツテスト(Maxプランのみ)。四半期ごとの計測値。
export interface SportsTestQuarterPoint {
  fiscalYear: number;
  quarter: number;
  values: Record<string, { label: string; value: number | null; unit: string; direction: "asc" | "desc" }>;
}

export interface PlayerSportsTestData {
  quarters: SportsTestQuarterPoint[];
}

export interface TeamSportsTestMetricSummary {
  label: string;
  unit: string;
  direction: "asc" | "desc";
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

export interface PracticeParticipationSummary {
  practicesHeld: number;
  attended: number; // 出席
  late: number; // 遅刻早退
  observed: number; // 見学(通常のトレーニング刺激とは扱わない)
  absent: number; // 欠席
  participationRate: number | null; // (出席+遅刻早退)/開催数。開催0件ならnull
}

export interface TeamPracticeParticipationSummary {
  practicesHeld: number;
  averageRate: number | null;
  medianRate: number | null;
  highParticipantCount: number; // 参加率80%以上
  lowParticipantCount: number; // 参加率50%未満
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
