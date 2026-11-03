/**
 * 新集金方式の独立した計算モジュール。
 * 既存の月額×周期の請求生成処理には接続しない。
 * 年度は4月〜翌3月。collectionMonthsは暦月(1〜12)。
 */
export type DuesJoinLeaveRule = "prorated" | "full";

export interface AnnualDuesSchedule {
  amountPerCollection: number;
  annualCount: number;
  collectionMonths: number[];
  joinLeaveRule: DuesJoinLeaveRule;
}

export const FISCAL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const;

export function validateAnnualDuesSchedule(schedule: AnnualDuesSchedule): string[] {
  const errors: string[] = [];
  if (!Number.isSafeInteger(schedule.amountPerCollection) || schedule.amountPerCollection <= 0) {
    errors.push("1回の集金額は1円以上の整数で指定してください");
  }
  if (!Number.isInteger(schedule.annualCount) || schedule.annualCount < 1 || schedule.annualCount > 12) {
    errors.push("年間回数は1〜12回で指定してください");
  }
  if (!Array.isArray(schedule.collectionMonths) ||
    schedule.collectionMonths.some(m => !Number.isInteger(m) || m < 1 || m > 12) ||
    new Set(schedule.collectionMonths).size !== schedule.collectionMonths.length ||
    schedule.collectionMonths.length !== schedule.annualCount) {
    errors.push("集金月は年間回数と同じ数だけ、重複なく選択してください");
  }
  if (schedule.joinLeaveRule !== "prorated" && schedule.joinLeaveRule !== "full") {
    errors.push("途中加入・退団時の請求ルールを指定してください");
  }
  return errors;
}

export function annualDuesTotal(schedule: AnnualDuesSchedule): number {
  const errors = validateAnnualDuesSchedule(schedule);
  if (errors.length) throw new Error(errors.join(" / "));
  const total = schedule.amountPerCollection * schedule.annualCount;
  if (!Number.isSafeInteger(total)) throw new Error("年間金額が安全な整数の範囲を超えています");
  return total;
}

export function sortedCollectionMonths(months: number[]): number[] {
  return [...months].sort((a, b) => FISCAL_MONTHS.indexOf(a as typeof FISCAL_MONTHS[number]) -
    FISCAL_MONTHS.indexOf(b as typeof FISCAL_MONTHS[number]));
}

export function fiscalMonthDate(fiscalYear: number, month: number): string {
  if (!Number.isInteger(fiscalYear) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("年度または月が不正です");
  }
  return `${month >= 4 ? fiscalYear : fiscalYear + 1}-${String(month).padStart(2, "0")}-01`;
}

export function collectionDates(schedule: AnnualDuesSchedule, fiscalYear: number): string[] {
  annualDuesTotal(schedule);
  return sortedCollectionMonths(schedule.collectionMonths).map(m => fiscalMonthDate(fiscalYear, m));
}

function parseIsoDate(value: string): { year: number; month: number; day: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("日付はYYYY-MM-DD形式で指定してください");
  const [year, month, day] = value.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) {
    throw new Error("存在しない日付です");
  }
  return { year, month, day };
}

/** 在籍開始・終了日は両端を含む。日割りせず在籍した月を1か月として扱う。 */
export function billableFiscalMonths(fiscalYear: number, startDate: string | null, stopDate: string | null): number[] {
  const start = startDate ? parseIsoDate(startDate) : null;
  const stop = stopDate ? parseIsoDate(stopDate) : null;
  if (start && stop && startDate! > stopDate!) throw new Error("退団日が加入日より前です");
  return FISCAL_MONTHS.filter(month => {
    const year = month >= 4 ? fiscalYear : fiscalYear + 1;
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const monthEnd = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthEndStr = `${year}-${String(month).padStart(2, "0")}-${monthEnd}`;
    return (!start || startDate! <= monthEndStr) && (!stop || stopDate! >= monthStart);
  });
}

/**
 * 在籍期間に応じた年間の請求総額。
 * proratedは年間総額×在籍月数/12を円単位で四捨五入する。
 * 月別の請求配分、過去の入金との差額処理、確認・確定は別レイヤーで行う。
 */
export function annualDuesDueForPlayer(
  schedule: AnnualDuesSchedule,
  fiscalYear: number,
  startDate: string | null,
  stopDate: string | null,
): number {
  const total = annualDuesTotal(schedule);
  const months = billableFiscalMonths(fiscalYear, startDate, stopDate).length;
  if (months === 0) return 0;
  return schedule.joinLeaveRule === "full" ? total : Math.round(total * months / 12);
}
