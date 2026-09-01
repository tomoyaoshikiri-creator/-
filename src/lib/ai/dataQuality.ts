import type { DataQualityAssessment } from "./types";

// データ品質を内部的にHIGH/MEDIUM/LOWで評価する。ユーザーには毎回スコアを見せないが、
// プロンプト側でこの結果を使って断定表現の強さを調整させる(データが少ないほど弱める)。
// 閾値は「厳密な統計基準」ではなく、育成年代の週1〜数回の練習・月1回程度の試合という
// このアプリの典型的な利用パターンを踏まえた目安。
//
// CONFIDENCE_RATIO_THRESHOLDS: score/maxScoreの比率、および出欠データカバー率の両方で
// 共通して使うHIGH/MEDIUM境界値。実運用データの分布がまだ十分に蓄積されていない段階の
// 暫定値のため、他の要素と同じ0.7/0.35に統一し、ここ1箇所を変更すれば全体に反映される
// ようにしている(将来、実データを踏まえて調整する場合はこの定数だけを直す)。
export const CONFIDENCE_RATIO_THRESHOLDS = { HIGH: 0.7, MEDIUM: 0.35 } as const;

function confidenceFromRatio(ratio: number): DataQualityAssessment["confidence"] {
  if (ratio >= CONFIDENCE_RATIO_THRESHOLDS.HIGH) return "HIGH";
  if (ratio >= CONFIDENCE_RATIO_THRESHOLDS.MEDIUM) return "MEDIUM";
  return "LOW";
}

interface PlayerDataQualityInput {
  gameCount: number;
  sportsTestQuarterCount: number | null; // proAiPlusではnull(評価対象外)
  practicesHeld: number;
  attendanceRecordedCount: number; // このうち、出欠記録が1件以上存在する回数
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

  // CIRCLE LINESは年度途中から利用開始されるチームがあり、運用開始以前の練習は出欠記録
  // そのものが存在しない。開催練習数(practicesHeld)ではなく、実際に出欠記録が存在する
  // 割合(出欠データカバー率)でスコアリングすることで、「記録が少ない」ことを
  // 「参加していない」と混同しないようにする。
  if (input.practicesHeld > 0) {
    const coverageRate = input.attendanceRecordedCount / input.practicesHeld;
    if (coverageRate >= CONFIDENCE_RATIO_THRESHOLDS.HIGH) score += 2;
    else if (coverageRate >= CONFIDENCE_RATIO_THRESHOLDS.MEDIUM) score += 1;
    const coverageDetail = `年度内開催${input.practicesHeld}回のうち出欠記録があるのは${input.attendanceRecordedCount}回(カバー率${Math.round(coverageRate * 1000) / 10}%)`;
    if (coverageRate < CONFIDENCE_RATIO_THRESHOLDS.MEDIUM) {
      notes.push(
        `${coverageDetail}。CIRCLE LINES上の出欠データの蓄積がまだ少ないため、年間を通した参加傾向は現時点では評価できない。記録が少ないことを練習参加の少なさや意欲の課題と解釈しないこと`,
      );
    } else if (coverageRate < CONFIDENCE_RATIO_THRESHOLDS.HIGH) {
      notes.push(`${coverageDetail}。年間を通した参加傾向の断定には注意が必要`);
    }
    // カバー率(割合)だけでなく記録回数そのもの(母数)も考慮する。固定の絶対閾値は設けず、
    // AI側が母数の小ささを踏まえて断定を弱めるようプロンプトの共通ルールに委ねる。
  } else {
    notes.push("この年度の開催練習の記録がない");
  }

  if (input.sportsTestQuarterCount !== null) {
    if (input.sportsTestQuarterCount >= 2) score += 2;
    else if (input.sportsTestQuarterCount === 1) {
      score += 1;
      notes.push("スポーツテストの計測が1回のみで、時系列変化は判断できない");
    }
  }

  if (input.growthPointCount >= 3) score += 1;

  const maxScore = input.sportsTestQuarterCount !== null ? 7 : 5;
  const confidence = confidenceFromRatio(score / maxScore);

  return { confidence, notes };
}

interface TeamDataQualityInput {
  rosterCount: number;
  gameCount: number;
  sportsTestMeasuredRatio: number | null; // 直近四半期の(測定人数/在籍人数)。proAiPlusではnull
  practicesHeld: number;
  attendanceRecordedSessionCount: number; // このうち、誰か1人でも出欠記録がある回数
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

  // 選手個人と同じ理由で、開催練習数ではなく出欠データカバー率(誰か1人でも記録がある
  // 練習の割合)でスコアリングする。
  if (input.practicesHeld > 0) {
    const coverageRate = input.attendanceRecordedSessionCount / input.practicesHeld;
    if (coverageRate >= CONFIDENCE_RATIO_THRESHOLDS.HIGH) score += 2;
    else if (coverageRate >= CONFIDENCE_RATIO_THRESHOLDS.MEDIUM) score += 1;
    const coverageDetail = `年度内開催${input.practicesHeld}回のうち出欠記録があるのは${input.attendanceRecordedSessionCount}回(カバー率${Math.round(coverageRate * 1000) / 10}%)`;
    if (coverageRate < CONFIDENCE_RATIO_THRESHOLDS.MEDIUM) {
      notes.push(
        `${coverageDetail}。CIRCLE LINES上の出欠データの蓄積がまだ少ないため、チームとして年間を通した参加傾向は現時点では評価できない。記録が少ないことをチームの練習参加率の低さや課題と解釈しないこと`,
      );
    } else if (coverageRate < CONFIDENCE_RATIO_THRESHOLDS.HIGH) {
      notes.push(`${coverageDetail}。年間を通した参加傾向の断定には注意が必要`);
    }
  } else {
    notes.push("この年度の開催練習の記録がない");
  }

  if (input.sportsTestMeasuredRatio !== null) {
    if (input.sportsTestMeasuredRatio >= 0.7) score += 2;
    else if (input.sportsTestMeasuredRatio >= 0.4) score += 1;
    if (input.sportsTestMeasuredRatio < 0.5) {
      notes.push("スポーツテストの測定人数が在籍人数に対して少なく、チーム全体の傾向としては参考程度");
    }
  }

  if (input.rosterCount < 5) notes.push("在籍選手数が少なく、チーム平均が少人数の結果に左右されやすい");

  const maxScore = input.sportsTestMeasuredRatio !== null ? 6 : 4;
  const confidence = confidenceFromRatio(score / maxScore);

  return { confidence, notes };
}
