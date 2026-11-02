import { describe, expect, it } from "vitest";
import { annualRateTotal, calculateDuesInstallments } from "./duesRatePlan";

describe("料金基準と集金月を分離した計算", () => {
  it("月額2500円を4・7・10・1月に3か月分ずつ請求", () => {
    const plan = { basis: "monthly" as const, amount: 2500, collectionMonths: [10, 4, 1, 7] };
    expect(calculateDuesInstallments(plan)).toEqual([
      { month: 4, amount: 7500, coveredMonths: [4, 5, 6] },
      { month: 7, amount: 7500, coveredMonths: [7, 8, 9] },
      { month: 10, amount: 7500, coveredMonths: [10, 11, 12] },
      { month: 1, amount: 7500, coveredMonths: [1, 2, 3] },
    ]);
    expect(annualRateTotal(plan)).toBe(30000);
  });
  it("月額で集金月が不均等なら集金額も変わる", () => {
    const installments = calculateDuesInstallments({ basis: "monthly", amount: 1000, collectionMonths: [4, 6, 10] });
    expect(installments.map(x => x.amount)).toEqual([2000, 4000, 6000]);
  });
  it("年額5000円を4月に1回集金", () => {
    expect(calculateDuesInstallments({ basis: "yearly", amount: 5000, collectionMonths: [4] })[0].amount).toBe(5000);
  });
  it("年額5000円を3回に分けて端数を配分", () => {
    expect(calculateDuesInstallments({ basis: "yearly", amount: 5000, collectionMonths: [4, 8, 12] }).map(x => x.amount)).toEqual([1667, 1667, 1666]);
  });
  it("月額0円、集金月の重複を拒否", () => {
    expect(() => annualRateTotal({ basis: "monthly", amount: 0, collectionMonths: [4] })).toThrow();
    expect(() => annualRateTotal({ basis: "monthly", amount: 2500, collectionMonths: [4, 4] })).toThrow();
  });
});
