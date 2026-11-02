/**
 * 集金の金額単位と請求周期を分離するための計算エンジン（段階導入用）。
 *
 * このモジュールは純粋関数のみ。既存のaccounting_dues_*テーブル・既存請求は変更しない。
 * DBマイグレーションとUI接続は別PRで行い、旧レコードのデフォルトはmonthlyとする。
 */
export type DuesAmountUnit = "monthly" | "yearly";
export type DuesJoinMonthRule = "include" | "next_month";
export type DuesAnnualProration = "full" | "monthly";
export type DuesChargeCycle = 1 | 2 | 3 | 6 | 12;

export interface DuesPricingRule {
  amountYen: number;
  amountUnit: DuesAmountUnit;
  cycleMonths: DuesChargeCycle;
  // 途中加入した月の扱い。日割りは行わず、必要な場合は個別調整で対応する。
  joinMonthRule: DuesJoinMonthRule;
  // 年額の費目だけに適用。満額 or 対象月数に応じて12分割。
  annualProration: DuesAnnualProration;
  // 選手別の免除・開始・終了日。nullなら期間制限なし。
  startDate: string | null;
  stopDate: string | null;
  exempt?: boolean;
  // 減免・追徴など、年度合計に対する整数円の個別調整。
  adjustmentYen?: number;
}

export interface DuesChargePreview {
  periodStart: string;
  periodEnd: string;
  amountYen: number;
  activeMonths: number;
}

function fiscalMonth(year: number, offset: number): string {
  const date = new Date(Date.UTC(year, 3 + offset, 1));
  return date.toISOString().slice(0, 7);
}

function monthIndex(date: string, fiscalYear: number): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return (year - fiscalYear) * 12 + month - 4;
}

function lastDayOfMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${yearMonth}-${String(last).padStart(2, "0")}`;
}

function assertValidDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new Error("日付はYYYY-MM-DDの実在日付で指定してください");
  }
}

export function previewDuesCharges(fiscalYear: number, rule: DuesPricingRule): DuesChargePreview[] {
  if (!Number.isInteger(fiscalYear) || fiscalYear < 1900 || fiscalYear > 9998) throw new Error("年度が不正です");
  if (!Number.isSafeInteger(rule.amountYen) || rule.amountYen < 0) throw new Error("金額は0以上の整数円で指定してください");
  if (![1, 2, 3, 6, 12].includes(rule.cycleMonths)) throw new Error("集金周期が不正です");
  if (!["monthly", "yearly"].includes(rule.amountUnit)) throw new Error("金額単位が不正です");
  if (!["include", "next_month"].includes(rule.joinMonthRule)) throw new Error("加入月ルールが不正です");
  if (!["full", "monthly"].includes(rule.annualProration)) throw new Error("年額の按分ルールが不正です");
  if (rule.startDate) assertValidDate(rule.startDate);
  if (rule.stopDate) assertValidDate(rule.stopDate);
  if (rule.startDate && rule.stopDate && rule.startDate > rule.stopDate) throw new Error("開始日は停止日以前にしてください");
  const adjustment = rule.adjustmentYen ?? 0;
  if (!Number.isSafeInteger(adjustment)) throw new Error("調整額は整数円で指定してください");

  const startIndex = rule.startDate ? monthIndex(rule.startDate, fiscalYear) : 0;
  // 前年度以前から在籍している選手は「加入月を除く」を当年度4月に適用しない。
  const first = startIndex + (rule.startDate && startIndex >= 0 && rule.joinMonthRule === "next_month" ? 1 : 0);
  const last = rule.stopDate ? monthIndex(rule.stopDate, fiscalYear) : 11;
  const active = Array.from({ length: 12 }, (_, i) => !rule.exempt && i >= first && i <= last);
  const monthly = Array<number>(12).fill(0);
  const activeIndices = active.flatMap((yes, i) => yes ? [i] : []);

  if (activeIndices.length) {
    if (rule.amountUnit === "monthly") {
      for (const i of activeIndices) monthly[i] = rule.amountYen;
    } else if (rule.annualProration === "full") {
      monthly[activeIndices[0]] = rule.amountYen;
    } else {
      // 累積丸めで各月に円単位を配分し、年間の丸め誤差を残さない。
      activeIndices.forEach((i, ordinal) => {
        monthly[i] = Math.round(rule.amountYen * (ordinal + 1) / 12)
          - Math.round(rule.amountYen * ordinal / 12);
      });
    }
    monthly[activeIndices[0]] += adjustment;
    if (monthly[activeIndices[0]] < 0) throw new Error("調整後の請求額が負数です");
  }

  const result: DuesChargePreview[] = [];
  for (let offset = 0; offset < 12; offset += rule.cycleMonths) {
    const periodStart = fiscalMonth(fiscalYear, offset) + "-01";
    const periodEnd = lastDayOfMonth(fiscalMonth(fiscalYear, offset + rule.cycleMonths - 1));
    const activeMonths = active.slice(offset, offset + rule.cycleMonths).filter(Boolean).length;
    const amountYen = monthly.slice(offset, offset + rule.cycleMonths).reduce((a, b) => a + b, 0);
    result.push({ periodStart, periodEnd, amountYen, activeMonths });
  }
  return result;
}
