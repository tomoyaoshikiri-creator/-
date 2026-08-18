import type { DataQualityAssessment } from "./types";

// データ品質を内部的にHIGH/MEDIUM/LOWで評価する。ユーザーには毎回スコアを見せないが、
// プロンプト側でこの結果を使って断定表現の強さを調整させる(データが少ないほど弱める)。
// 閾値は「厳密な統計基準」ではなく、育成年代の週1〜数回の練習・月1回程度の試合という
// このアプリの典型的な利用パターンを踏まえた目安。

interface PlayerDataQualityInput {
  gameCount: number;
  sportsTestQuarterCount: number | null; // proAiPlusではnull(評価対象外)
  practicesHeld: number;
  growthPointCount: number;
}

export function assessPlayerDataQuality(input: PlayerDataQualityInput): DataQualityAssessment {
  const notes: string[] = [];
  let score = 0;

  if (input.gameCount >= 5) score += 2;
  else if (input.gameCount >= 2) score += 1;
  if (input.gameCount === 0) notes.push("この年度の試合出場記録がない");
  else if (input.gameCount === 1) notes.push("この年度の試合出場が1試合のみで、傾向の判断材料としては不十分");
  else if (input.gameCount <= 3) {
    notes.push(`この年度の出場試合数が${input.gameCount}試合と少なく、試合ごとの数値の変化を継続的な傾向として評価しないこと`);
  }

  if (input.practicesHeld >= 8) score += 2;
  else if (input.practicesHeld >= 3) score += 1;
  else notes.push("この年度の開催練習数が少ない");

  if (input.sportsTestQuarterCount !== null) {
    if (input.sportsTestQuarterCount >= 2) score += 2;
    else if (input.sportsTestQuarterCount === 1) {
      score += 1;
      notes.push("スポーツテストの計測が1回のみで、時系列変化は判断できない");
    }
  }

  if (input.growthPointCount >= 3) score += 1;

  const maxScore = input.sportsTestQuarterCount !== null ? 7 : 5;
  const ratio = score / maxScore;
  const confidence: DataQualityAssessment["confidence"] = ratio >= 0.7 ? "HIGH" : ratio >= 0.35 ? "MEDIUM" : "LOW";

  return { confidence, notes };
}

interface TeamDataQualityInput {
  rosterCount: number;
  gameCount: number;
  sportsTestMeasuredRatio: number | null; // 直近四半期の(測定人数/在籍人数)。proAiPlusではnull
  practicesHeld: number;
}

export function assessTeamDataQuality(input: TeamDataQualityInput): DataQualityAssessment {
  const notes: string[] = [];
  let score = 0;

  if (input.gameCount >= 5) score += 2;
  else if (input.gameCount >= 2) score += 1;
  if (input.gameCount === 0) notes.push("この年度のチームとしての試合出場記録がない");
  else if (input.gameCount <= 3) {
    notes.push(
      `この年度の試合数が${input.gameCount}試合と少なく、試合ごとの数値の変化を継続的な傾向として評価しないこと`,
    );
  }

  if (input.practicesHeld >= 8) score += 2;
  else if (input.practicesHeld >= 3) score += 1;
  else notes.push("この年度の開催練習数が少ない");

  if (input.sportsTestMeasuredRatio !== null) {
    if (input.sportsTestMeasuredRatio >= 0.7) score += 2;
    else if (input.sportsTestMeasuredRatio >= 0.4) score += 1;
    if (input.sportsTestMeasuredRatio < 0.5) {
      notes.push("スポーツテストの測定人数が在籍人数に対して少なく、チーム全体の傾向としては参考程度");
    }
  }

  if (input.rosterCount < 5) notes.push("在籍選手数が少なく、チーム平均が少人数の結果に左右されやすい");

  const maxScore = input.sportsTestMeasuredRatio !== null ? 6 : 4;
  const ratio = score / maxScore;
  const confidence: DataQualityAssessment["confidence"] = ratio >= 0.7 ? "HIGH" : ratio >= 0.35 ? "MEDIUM" : "LOW";

  return { confidence, notes };
}
