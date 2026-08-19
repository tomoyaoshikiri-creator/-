// カスタムスタッツ(バスケットボール・ミニバスケットボール以外の6競技共通)を、
// AI分析向けにaggregation_type別の意味の通った数値へ集計するための純粋関数群。
// 選手個人分析・チーム分析の両方から、対象エントリを絞り込んだ上で共通して使う。
//
// 大原則: 「記録が存在しない」ことを0として扱わない。合計・平均の分母・件数は、
// 常に実際に記録が存在する選手・試合・エントリのみを対象に数える。

export type AggregationType = "SUM" | "AVERAGE" | "RATE" | "NEUTRAL" | null;

export interface CategoryEntry {
  match_id: string;
  player_id: string;
  value: number;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export interface CategorySeasonAggregate {
  seasonTotal: number | null;
  seasonAverage: number | null;
  recordedEntryCount: number;
  recordedGameCount: number;
  recordedPlayerCount: number;
}

// あるカテゴリの「シーズン合計・シーズン平均」をaggregation_typeに応じて算出する。
// entriesは呼び出し側で既にそのカテゴリだけに絞り込んだものを渡す。
// - SUM: seasonTotal=記録済み全エントリの合計。seasonAverage=記録済み試合
//   (1件以上記録がある試合)ごとの合計値の平均(記録のない試合は分母に含めない)。
// - AVERAGE / RATE: seasonTotal=null。seasonAverage=記録済みエントリ全体の単純平均
//   (記録のない選手・試合は0として含めない)。
// - NEUTRAL / 未設定(null): 集計方法が定義されていないため、システム側で合計・平均を
//   勝手に決めて算出しない(常にnull)。
export function aggregateCategorySeasonForAi(
  entries: CategoryEntry[],
  aggregationType: AggregationType,
): CategorySeasonAggregate {
  const recordedEntryCount = entries.length;
  const recordedGameCount = new Set(entries.map((e) => e.match_id)).size;
  const recordedPlayerCount = new Set(entries.map((e) => e.player_id)).size;
  const base = { recordedEntryCount, recordedGameCount, recordedPlayerCount };

  if (recordedEntryCount === 0) {
    return { seasonTotal: null, seasonAverage: null, ...base };
  }
  if (aggregationType === "SUM") {
    const seasonTotal = round1(entries.reduce((sum, e) => sum + e.value, 0));
    const byMatch = new Map<string, number>();
    entries.forEach((e) => byMatch.set(e.match_id, (byMatch.get(e.match_id) ?? 0) + e.value));
    const matchTotals = Array.from(byMatch.values());
    const seasonAverage = round1(matchTotals.reduce((sum, v) => sum + v, 0) / matchTotals.length);
    return { seasonTotal, seasonAverage, ...base };
  }
  if (aggregationType === "AVERAGE" || aggregationType === "RATE") {
    const seasonAverage = round1(entries.reduce((sum, e) => sum + e.value, 0) / recordedEntryCount);
    return { seasonTotal: null, seasonAverage, ...base };
  }
  // NEUTRAL または未設定(null)
  return { seasonTotal: null, seasonAverage: null, ...base };
}

export type CategoryMatchAggregate =
  | { kind: "aggregated"; value: number; recordedCount: number }
  | { kind: "raw"; rawValues: number[]; recordedCount: number };

// 1試合分の、あるカテゴリのエントリから提示用の値を算出する。
// SUM/AVERAGE/RATEは単一の集計値+記録選手数を返す。NEUTRAL・未設定は集計せず、
// 記録された生の値をそのまま返す(自動でチーム合計・平均を作らない)。
// このカテゴリの記録が1件もない試合はnullを返す(0として扱わない)。
export function aggregateCategoryMatchForAi(
  entries: CategoryEntry[],
  aggregationType: AggregationType,
): CategoryMatchAggregate | null {
  if (entries.length === 0) return null;
  if (aggregationType === "SUM") {
    return { kind: "aggregated", value: round1(entries.reduce((sum, e) => sum + e.value, 0)), recordedCount: entries.length };
  }
  if (aggregationType === "AVERAGE" || aggregationType === "RATE") {
    return {
      kind: "aggregated",
      value: round1(entries.reduce((sum, e) => sum + e.value, 0) / entries.length),
      recordedCount: entries.length,
    };
  }
  return { kind: "raw", rawValues: entries.map((e) => e.value), recordedCount: entries.length };
}
