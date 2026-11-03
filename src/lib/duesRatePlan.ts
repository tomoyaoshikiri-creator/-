import { FISCAL_MONTHS, sortedCollectionMonths } from "./duesAnnualSchedule";

export type DuesRateBasis = "monthly" | "yearly";
export interface DuesRatePlan {
  basis: DuesRateBasis;
  amount: number;
  collectionMonths: number[];
}
export interface DuesInstallment {
  month: number;
  amount: number;
  coveredMonths: number[];
}

/**
 * 年度は4月〜翌3月。各集金月から次の集金月の前月までを請求する。
 * 最初の集金月が4月以外の場合は、年度開始から最初の集金月の前月分も
 * 最初の請求に含める（年度内の12か月に欠落・重複を作らない）。
 * 年額は年額を回数で均等割りし、余りの円は年度順の早い集金月に配分。
 */
export function calculateDuesInstallments(plan: DuesRatePlan): DuesInstallment[] {
  if (!Number.isSafeInteger(plan.amount) || plan.amount <= 0) throw new Error("料金は1円以上の整数で入力してください");
  const months = sortedCollectionMonths(plan.collectionMonths);
  if (months.length < 1 || months.length > 12 ||
    months.some(m => !FISCAL_MONTHS.includes(m as typeof FISCAL_MONTHS[number])) ||
    new Set(months).size !== months.length) {
    throw new Error("集金月を1〜12か月、重複なく指定してください");
  }
  const positions = months.map(m => FISCAL_MONTHS.indexOf(m as typeof FISCAL_MONTHS[number]));
  const coveredByCollection = months.map((_, i) => {
    const start = i === 0 ? 0 : positions[i];
    const end = i === months.length - 1 ? 12 : positions[i + 1];
    return FISCAL_MONTHS.slice(start, end);
  });
  const amounts = plan.basis === "yearly"
    ? months.map((_, i) => Math.floor(plan.amount / months.length) + (i < plan.amount % months.length ? 1 : 0))
    : coveredByCollection.map(covered => plan.amount * covered.length);
  if (plan.basis !== "monthly" && plan.basis !== "yearly") throw new Error("料金基準が不正です");
  if (amounts.some(amount => !Number.isSafeInteger(amount))) throw new Error("請求額が上限を超えています");
  return months.map((month, i) => ({
    month,
    amount: amounts[i],
    coveredMonths: [...coveredByCollection[i]],
  }));
}
export function annualRateTotal(plan: DuesRatePlan): number {
  const installments = calculateDuesInstallments(plan);
  return installments.reduce((sum, installment) => sum + installment.amount, 0);
}
