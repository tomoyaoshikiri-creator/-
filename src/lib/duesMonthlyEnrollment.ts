import { billableFiscalMonths } from "./duesAnnualSchedule";
import { calculateDuesInstallments, type DuesRatePlan } from "./duesRatePlan";

export function previewMonthlyEnrollment(params: {
  plan: DuesRatePlan;
  fiscalYear: number;
  startDate: string | null;
  stopDate: string | null;
  fullPeriod: boolean;
}) {
  if (params.plan.basis !== "monthly") throw new Error("Monthly rate required");
  const enrolled = new Set(billableFiscalMonths(params.fiscalYear, params.startDate, params.stopDate));
  return calculateDuesInstallments(params.plan).map(installment => {
    const coveredMonths = installment.coveredMonths.filter(month => enrolled.has(month));
    const amount = coveredMonths.length === 0 ? 0 : params.fullPeriod
      ? installment.amount : params.plan.amount * coveredMonths.length;
    return { collectionMonth: installment.month, amount, coveredMonths };
  }).filter(row => row.amount > 0);
}
