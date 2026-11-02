import { describe, expect, it } from "vitest";
import { previewDuesCharges, type DuesPricingRule } from "./duesPricing";

const base: DuesPricingRule = {
  amountYen: 2500,
  amountUnit: "monthly",
  cycleMonths: 12,
  joinMonthRule: "include",
  annualProration: "full",
  startDate: null,
  stopDate: null,
};

describe("previewDuesCharges", () => {
  it("月額2500円・年払いは年度全体で30000円", () => {
    expect(previewDuesCharges(2026, base)[0].amountYen).toBe(30000);
  });
  it("7月途中加入なら7〜3月の9か月分", () => {
    const result = previewDuesCharges(2026, { ...base, startDate: "2026-07-20" });
    expect(result[0]).toMatchObject({ amountYen: 22500, activeMonths: 9 });
  });
  it("加入月を除くなら8〜3月の8か月分", () => {
    expect(previewDuesCharges(2026, { ...base, startDate: "2026-07-20", joinMonthRule: "next_month" })[0].amountYen).toBe(20000);
  });
  it("年額5000円は年払いで5000円、途中加入でも満額", () => {
    expect(previewDuesCharges(2026, { ...base, amountYen: 5000, amountUnit: "yearly", startDate: "2026-10-10" })[0].amountYen).toBe(5000);
  });
  it("年額12000円の10月加入・月割りは6000円", () => {
    expect(previewDuesCharges(2026, { ...base, amountYen: 12000, amountUnit: "yearly", annualProration: "monthly", startDate: "2026-10-01" })[0].amountYen).toBe(6000);
  });
  it("年額12001円の月払いは端数を含め合計12001円", () => {
    const result = previewDuesCharges(2026, { ...base, amountYen: 12001, amountUnit: "yearly", annualProration: "monthly", cycleMonths: 1 });
    expect(result).toHaveLength(12);
    expect(result.reduce((sum, p) => sum + p.amountYen, 0)).toBe(12001);
  });
  it("年額満額・月払いは加入した月の請求に計上する", () => {
    const result = previewDuesCharges(2026, { ...base, amountYen: 12000, amountUnit: "yearly", cycleMonths: 1, startDate: "2026-10-01" });
    expect(result[5].amountYen).toBe(0);
    expect(result[6].amountYen).toBe(12000);
  });
  it("免除は0円", () => {
    expect(previewDuesCharges(2026, { ...base, exempt: true })[0].amountYen).toBe(0);
  });
  it("年度途中の停止を反映する", () => {
    expect(previewDuesCharges(2026, { ...base, stopDate: "2026-09-12" })[0].amountYen).toBe(15000);
  });
  it("年度をまたぐ1〜3月も正しく集計する", () => {
    const result = previewDuesCharges(2026, { ...base, cycleMonths: 3, startDate: "2027-01-15" });
    expect(result.map((x) => x.amountYen)).toEqual([0, 0, 0, 7500]);
    expect(result[3].periodEnd).toBe("2027-03-31");
  });
  it("不正な日付と金額を拒否する", () => {
    expect(() => previewDuesCharges(2026, { ...base, startDate: "2026-02-30" })).toThrow();
    expect(() => previewDuesCharges(2026, { ...base, amountYen: -1 })).toThrow();
  });
});
