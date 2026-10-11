import type { DuesPricingMethod } from "@/lib/accounting";

export interface DuesPeriod {
  periodStart: string;
  periodEnd: string;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 年度(4月始まり)を周期月数ごとに連続したブロックへ区切り、todayStr時点で開始済みの
// 期間だけを返す(ユーザー引き継ぎメモ 3-6: 3か月ごとなら4〜6月・7〜9月・10〜12月・1〜3月)。
// Dateのmonthは繰り上がり(例: 3+11=14月→ 翌々年2月)を自動で正規化するため、年度をまたぐ
// 周期(例: 1〜3月)も特別扱いせずに計算できる。
export function computeDuesPeriods(fiscalYear: number, cycleMonths: number, todayStr: string): DuesPeriod[] {
  const periods: DuesPeriod[] = [];
  for (let offset = 0; offset < 12; offset += cycleMonths) {
    const start = new Date(fiscalYear, 3 + offset, 1);
    const end = new Date(fiscalYear, 3 + offset + cycleMonths, 0);
    const periodStart = toDateStr(start);
    if (periodStart > todayStr) break;
    periods.push({ periodStart, periodEnd: toDateStr(end) });
  }
  return periods;
}

export interface DuesPlayerSettingLike {
  monthly_amount: number | null;
  exempt: boolean;
  start_date: string | null;
  stop_date: string | null;
}

export interface DuesGradeBandLike {
  grade_min: number;
  grade_max: number;
  monthly_amount: number;
}

// 選手1人の月額を決める。免除ならnull(請求対象外)。pricing_method別の基準額に、
// 選手ごとの個別設定(上書き額、per_playerの場合は基準額そのもの)を適用する。
export function resolveMonthlyAmount(params: {
  pricingMethod: DuesPricingMethod;
  flatMonthlyAmount: number | null;
  grade: number | null;
  gradeBands: DuesGradeBandLike[];
  playerSetting: DuesPlayerSettingLike | null;
}): number | null {
  const { pricingMethod, flatMonthlyAmount, grade, gradeBands, playerSetting } = params;
  if (playerSetting?.exempt) return null;
  if (playerSetting?.monthly_amount !== null && playerSetting?.monthly_amount !== undefined) {
    return playerSetting.monthly_amount;
  }
  if (pricingMethod === "per_player") return null; // 個別設定が無ければ請求対象外
  if (pricingMethod === "flat") return flatMonthlyAmount;
  // grade_band
  if (grade === null) return null;
  const band = gradeBands.find((b) => grade >= b.grade_min && grade <= b.grade_max);
  return band ? band.monthly_amount : null;
}

// 集金期間の途中で入部・退部しても満額請求する方針(ユーザー引き継ぎメモ 3-6 項番7の
// 回答)のため、開始・停止月は「その期間を対象にするかどうか」の判定にのみ使う
// (日割りはしない)。
export function isPlayerBillableForPeriod(
  period: DuesPeriod,
  setting: Pick<DuesPlayerSettingLike, "start_date" | "stop_date"> | null,
): boolean {
  if (!setting) return true;
  if (setting.start_date && setting.start_date > period.periodEnd) return false;
  if (setting.stop_date && setting.stop_date < period.periodStart) return false;
  return true;
}

export function duesPeriodLabel(period: DuesPeriod): string {
  const startMonth = Number(period.periodStart.slice(5, 7));
  const endMonth = Number(period.periodEnd.slice(5, 7));
  return startMonth === endMonth ? `${startMonth}月分` : `${startMonth}〜${endMonth}月分`;
}
