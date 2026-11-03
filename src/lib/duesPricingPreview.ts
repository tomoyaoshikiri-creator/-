import { resolveMonthlyAmount, type DuesGradeBandLike, type DuesPlayerSettingLike } from "./accountingDues";
import type { DuesPricingMethod } from "./accounting";
import { calculateDuesInstallments, type DuesRateBasis, type DuesRatePlan } from "./duesRatePlan";

/**
 * 一律・学年帯・選手別の料金を同じ集金月ルールで計算するための
 * 保存前プレビュー専用アダプター。
 *
 * 現行DBの grade_bands.monthly_amount と player_settings.monthly_amount は
 * 月額専用。年額の学年別・選手別設定には新しいDB列が必要なため、
 * この関数は monthly のみを受け付ける。
 */
export function previewPlayerDues(params: {
  basis: DuesRateBasis;
  pricingMethod: DuesPricingMethod;
  flatAmount: number | null;
  grade: number | null;
  gradeBands: DuesGradeBandLike[];
  playerSetting: DuesPlayerSettingLike | null;
  collectionMonths: number[];
}) {
  if (params.basis !== "monthly") {
    throw new Error("年額の学年別・選手別料金はDB設計確定後に対応します");
  }
  const monthly = resolveMonthlyAmount({
    pricingMethod: params.pricingMethod,
    flatMonthlyAmount: params.flatAmount,
    grade: params.grade,
    gradeBands: params.gradeBands,
    playerSetting: params.playerSetting,
  });
  if (monthly === null || monthly === 0) return null;
  const plan: DuesRatePlan = { basis: "monthly", amount: monthly, collectionMonths: params.collectionMonths };
  const installments = calculateDuesInstallments(plan);
  return { monthlyAmount: monthly, annualTotal: installments.reduce((sum, row) => sum + row.amount, 0), installments };
}
