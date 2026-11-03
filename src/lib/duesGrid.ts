/** 年度別の集金チェック表に表示する月ごとの入金状態。 */
export type DuesMonthStatus = "paid" | "unpaid" | "none";

export interface DuesGridPeriod {
  id: string;
  period_start: string;
  period_end: string;
}
export interface DuesGridCharge {
  billing_period_id: string;
  player_id: string;
  status: string;
}

export const FISCAL_GRID_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const;

/** 請求が存在しない月は「－」。未納が一件でもあれば「未」。 */
export function duesGridStatus(
  playerId: string,
  month: number,
  periods: DuesGridPeriod[],
  charges: DuesGridCharge[],
): DuesMonthStatus {
  const periodIds = new Set(periods.filter(p => Number(p.period_start.slice(5, 7)) === month).map(p => p.id));
  const relevant = charges.filter(c => c.player_id === playerId && periodIds.has(c.billing_period_id));
  if (relevant.length === 0) return "none";
  return relevant.every(c => c.status === "paid") ? "paid" : "unpaid";
}

/** 同じ学年なら背番号順、未設定は最後。 */
export function sortDuesPlayers<T extends { grade: string | number | null; number?: string | number | null }>(players: T[]): T[] {
  return [...players].sort((a, b) => {
    const gradeA = a.grade === null ? -1 : Number(a.grade);
    const gradeB = b.grade === null ? -1 : Number(b.grade);
    if (gradeA !== gradeB) return gradeB - gradeA;
    const numberA = a.number === null || a.number === undefined || a.number === "" ? Infinity : Number(a.number);
    const numberB = b.number === null || b.number === undefined || b.number === "" ? Infinity : Number(b.number);
    return numberA - numberB;
  });
}
