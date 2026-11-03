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
  it("4月以外が初回でも年度の12か月を漏れなく請求する", () => {
    const rows = calculateDuesInstallments({ basis: "monthly", amount: 2500, collectionMonths: [8, 11, 2] });
    expect(rows).toEqual([
      { month: 8, amount: 17500, coveredMonths: [4, 5, 6, 7, 8, 9, 10] },
      { month: 11, amount: 7500, coveredMonths: [11, 12, 1] },
      { month: 2, amount: 5000, coveredMonths: [2, 3] },
    ]);
    expect(rows.flatMap(row => row.coveredMonths)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]);
    expect(annualRateTotal({ basis: "monthly", amount: 2500, collectionMonths: [8, 11, 2] })).toBe(30000);
  });
  it("集金月が1回で4月以外でも年間12か月を対象とする", () => {
    expect(calculateDuesInstallments({ basis: "monthly", amount: 2500, collectionMonths: [10] })[0].amount).toBe(30000);
  });
  it("月額0円、集金月の重複を拒否", () => {
    expect(() => annualRateTotal({ basis: "monthly", amount: 0, collectionMonths: [4] })).toThrow();
    expect(() => annualRateTotal({ basis: "monthly", amount: 2500, collectionMonths: [4, 4] })).toThrow();
  });
  it("学年帯の年額1200円を4月に全額集金する", () => {
    expect(calculateDuesInstallments({basis:"yearly",amount:1200,collectionMonths:[4]}))
      .toEqual([{month:4,amount:1200,coveredMonths:[4,5,6,7,8,9,10,11,12,1,2,3]}]);
  });
  it("学年帯の年額1201円を3回に分けても総額が一致する", () => {
    const rows=calculateDuesInstallments({basis:"yearly",amount:1201,collectionMonths:[1,4,10]});
    expect(rows.map(r=>[r.month,r.amount])).toEqual([[4,401],[10,400],[1,400]]);
    expect(rows.reduce((sum,r)=>sum+r.amount,0)).toBe(1201);
  });
});
