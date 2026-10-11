export type AccountingKind = "income" | "expense";
export type AccountingOfficerRole = "担当" | "監査";

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
