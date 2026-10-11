export type AccountingKind = "income" | "expense";
export type AccountingOfficerRole = "担当" | "監査";
export type DuesPricingMethod = "flat" | "grade_band" | "per_player";
export type DuesCycleMonths = 1 | 2 | 3 | 6 | 12;
export type DuesPaymentMethod = "cash" | "bank_transfer" | "other";
export type DuesBillingUnit = "player" | "household";

export const ACCOUNTING_KIND_LABELS: Record<AccountingKind, string> = {
  income: "収入",
  expense: "支出",
};

export const ACCOUNTING_OFFICER_ROLE_LABELS: Record<AccountingOfficerRole, string> = {
  担当: "会計担当",
  監査: "会計監査",
};

// 会計担当は最大2名、会計監査は1名(ユーザー引き継ぎメモ)。DB上はハード制限せず、
// UI側で人数の案内・警告に使う(厳密な上限強制が必要になった場合はDB制約を別途追加する)。
export const ACCOUNTING_MAX_OFFICERS: Record<AccountingOfficerRole, number> = {
  担当: 2,
  監査: 1,
};

// 前年度繰越金(収入)。年度を締めると自動で計上される特別項目で、手入力の項目一覧には
// 出さない(ユーザー引き継ぎメモ 3-2)。
export const CARRY_OVER_CATEGORY_NAME = "前年度繰越金";

// 都賀ビクトリーズが実際に使っていた項目のテンプレート。チームごとに自由に追加・編集・
// 削除・並べ替えができるため固定の列挙ではないが、初回セットアップ時に「テンプレートから
// 追加」で一括登録できるようにする(ユーザー引き継ぎメモ 3-2、他チームへの販売を前提とし
// 固定にしない方針のため、あくまで初期値の提案)。
export const ACCOUNTING_CATEGORY_TEMPLATE: Record<AccountingKind, string[]> = {
  income: ["部費", "保険料", "Team JBA登録料", "行事費", "雑収入", "お礼費徴収"],
  expense: [
    "Team JBA登録料(チーム)",
    "Team JBA登録料(選手)",
    "Team JBA登録料(指導者)",
    "大会登録費",
    "講習会費",
    "交通費",
    "用具費",
    "行事費",
    "事務費",
    "交際費",
    "お礼費",
    "親睦会費",
    "雑費",
    "積立費",
  ],
};

export function formatYen(amount: number): string {
  return `¥${Math.round(amount).toLocaleString("ja-JP")}`;
}

export const DUES_PRICING_METHOD_LABELS: Record<DuesPricingMethod, string> = {
  flat: "一律",
  grade_band: "学年帯ごと",
  per_player: "選手ごとに個別指定",
};

// 集金の周期(月数)。常に年度始まり(4月)を基準に連続したブロックとして期間を区切る
// (例: 3か月=4〜6月・7〜9月・10〜12月・1〜3月)。
export const DUES_CYCLE_MONTHS_LABELS: Record<DuesCycleMonths, string> = {
  1: "毎月",
  2: "2か月ごと",
  3: "3か月ごと",
  6: "半年ごと",
  12: "年1回",
};
export const DUES_CYCLE_MONTHS_OPTIONS: DuesCycleMonths[] = [1, 2, 3, 6, 12];

export const DUES_PAYMENT_METHOD_LABELS: Record<DuesPaymentMethod, string> = {
  cash: "現金手渡し",
  bank_transfer: "振込",
  other: "その他",
};
export const DUES_PAYMENT_METHOD_OPTIONS: DuesPaymentMethod[] = ["cash", "bank_transfer", "other"];

export const DUES_BILLING_UNIT_LABELS: Record<DuesBillingUnit, string> = {
  player: "選手ごと",
  household: "家庭ごと",
};

// 選手の学年(players.gradeと同じ絶対スケール)を学年帯の一覧から探し、月額を返す。
// 該当する帯が無ければnull(未設定として扱う)。
export function monthlyAmountFromGradeBands(
  grade: number,
  bands: { grade_min: number; grade_max: number; monthly_amount: number }[],
): number | null {
  const band = bands.find((b) => grade >= b.grade_min && grade <= b.grade_max);
  return band ? Number(band.monthly_amount) : null;
}
