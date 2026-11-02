import { describe, expect, it } from "vitest";
import { previewPlayerDues } from "./duesPricingPreview";

const base = {
  basis: "monthly" as const,
  flatAmount: 2500,
  grade: 5,
  gradeBands: [{ grade_min: 1, grade_max: 3, monthly_amount: 1500 }, { grade_min: 4, grade_max: 6, monthly_amount: 2000 }],
  playerSetting: null,
  collectionMonths: [4, 7, 10, 1],
};

describe("料金方式と集金月の組み合わせ", () => {
  it("一律料金を3か月ごとに集金", () => {
    const result = previewPlayerDues({ ...base, pricingMethod: "flat" });
    expect(result?.annualTotal).toBe(30000);
    expect(result?.installments.map(row => row.amount)).toEqual([7500, 7500, 7500, 7500]);
  });
  it("学年帯別料金を3か月ごとに集金", () => {
    const result = previewPlayerDues({ ...base, pricingMethod: "grade_band" });
    expect(result?.annualTotal).toBe(24000);
    expect(result?.installments[0].amount).toBe(6000);
  });
  it("選手別の上書き額を優先", () => {
    const result = previewPlayerDues({ ...base, pricingMethod: "grade_band", playerSetting: { monthly_amount: 1000, exempt: false, start_date: null, stop_date: null } });
    expect(result?.annualTotal).toBe(12000);
  });
  it("選手ごとの料金を設定できる", () => {
    const result = previewPlayerDues({ ...base, pricingMethod: "per_player", playerSetting: { monthly_amount: 1800, exempt: false, start_date: null, stop_date: null } });
    expect(result?.installments[0].amount).toBe(5400);
  });
  it("免除・個別料金未設定なら請求なし", () => {
    expect(previewPlayerDues({ ...base, pricingMethod: "flat", playerSetting: { monthly_amount: null, exempt: true, start_date: null, stop_date: null } })).toBeNull();
    expect(previewPlayerDues({ ...base, pricingMethod: "per_player" })).toBeNull();
  });
  it("年額の学年帯料金は未対応として明示的に拒否", () => {
    expect(() => previewPlayerDues({ ...base, basis: "yearly", pricingMethod: "grade_band" })).toThrow("DB設計確定後");
  });
});
