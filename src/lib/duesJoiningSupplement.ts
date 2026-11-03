import { billableFiscalMonths } from "./duesAnnualSchedule";
import { calculateDuesInstallments, type DuesRatePlan } from "./duesRatePlan";

/**
 * 入団時の臨時請求候補を計算する。DBには保存せず、管理者の確認・確定が必要。
 * すでに開始した集金期間のうち、入団月以降の未経過月のみ対象にする。
 * 日割りはせず、入団月を含む。
 */
export function previewJoiningSupplement(params: {
  plan: DuesRatePlan;
  fiscalYear: number;
  joinDate: string;
}): { collectionMonth: number; coveredMonths: number[]; amount: number } | null {
  if (params.plan.basis !== "monthly") {
    throw new Error("年額料金の途中加入計算は別途確定が必要です");
  }
  const enrolledMonths = billableFiscalMonths(params.fiscalYear, params.joinDate, null);
  if (!enrolledMonths.length) return null;
  const joinMonth = enrolledMonths[0];
  const fiscalMonths = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
  const joinPosition = fiscalMonths.indexOf(joinMonth);
  const activeMonths = new Set(enrolledMonths);
  const period = calculateDuesInstallments(params.plan).find(row => {
    const start = fiscalMonths.indexOf(row.month);
    return start < joinPosition && row.coveredMonths.includes(joinMonth);
  });
  if (!period) return null;
  const coveredMonths = period.coveredMonths.filter(month => activeMonths.has(month));
  const amount = params.plan.amount * coveredMonths.length;
  if (!Number.isSafeInteger(amount)) throw new Error("請求額が上限を超えています");
  return amount > 0 ? { collectionMonth: period.month, coveredMonths, amount } : null;
}
