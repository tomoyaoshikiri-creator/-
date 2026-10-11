import { describe, expect, it } from "vitest";
import { computeDuesPeriods, duesPeriodLabel, isPlayerBillableForPeriod, resolveMonthlyAmount } from "../accountingDues";

describe("computeDuesPeriods", () => {
  it("3か月ごとなら4〜6月・7〜9月のように区切る(年度をまたぐ1〜3月も含む)", () => {
    const periods = computeDuesPeriods(2026, 3, "2027-02-01");
    expect(periods).toEqual([
      { periodStart: "2026-04-01", periodEnd: "2026-06-30" },
      { periodStart: "2026-07-01", periodEnd: "2026-09-30" },
      { periodStart: "2026-10-01", periodEnd: "2026-12-31" },
      { periodStart: "2027-01-01", periodEnd: "2027-03-31" },
    ]);
  });

  it("todayStrより後に開始する期間は含めない", () => {
    const periods = computeDuesPeriods(2026, 3, "2026-08-01");
    expect(periods).toEqual([
      { periodStart: "2026-04-01", periodEnd: "2026-06-30" },
      { periodStart: "2026-07-01", periodEnd: "2026-09-30" },
    ]);
  });

  it("毎月(1か月ごと)なら12期間に区切る", () => {
    const periods = computeDuesPeriods(2026, 1, "2027-03-31");
    expect(periods).toHaveLength(12);
    expect(periods[0]).toEqual({ periodStart: "2026-04-01", periodEnd: "2026-04-30" });
    expect(periods[11]).toEqual({ periodStart: "2027-03-01", periodEnd: "2027-03-31" });
  });

  it("年1回(12か月ごと)なら年度全体が1期間になる", () => {
    const periods = computeDuesPeriods(2026, 12, "2027-03-31");
    expect(periods).toEqual([{ periodStart: "2026-04-01", periodEnd: "2027-03-31" }]);
  });
});

describe("resolveMonthlyAmount", () => {
  it("免除されている選手はnull", () => {
    const amount = resolveMonthlyAmount({
      pricingMethod: "flat",
      flatMonthlyAmount: 2000,
      grade: 3,
      gradeBands: [],
      playerSetting: { monthly_amount: null, exempt: true, start_date: null, stop_date: null },
    });
    expect(amount).toBeNull();
  });

  it("個別設定の金額があれば一律・学年帯より優先する", () => {
    const amount = resolveMonthlyAmount({
      pricingMethod: "flat",
      flatMonthlyAmount: 2000,
      grade: 3,
      gradeBands: [],
      playerSetting: { monthly_amount: 1500, exempt: false, start_date: null, stop_date: null },
    });
    expect(amount).toBe(1500);
  });

  it("一律方式は個別設定が無ければflatMonthlyAmount", () => {
    const amount = resolveMonthlyAmount({
      pricingMethod: "flat",
      flatMonthlyAmount: 2000,
      grade: 3,
      gradeBands: [],
      playerSetting: null,
    });
    expect(amount).toBe(2000);
  });

  it("学年帯方式は該当する帯の金額を返す", () => {
    const amount = resolveMonthlyAmount({
      pricingMethod: "grade_band",
      flatMonthlyAmount: null,
      grade: 4,
      gradeBands: [
        { grade_min: 1, grade_max: 3, monthly_amount: 2000 },
        { grade_min: 4, grade_max: 6, monthly_amount: 2500 },
      ],
      playerSetting: null,
    });
    expect(amount).toBe(2500);
  });

  it("学年帯方式で該当する帯が無ければnull", () => {
    const amount = resolveMonthlyAmount({
      pricingMethod: "grade_band",
      flatMonthlyAmount: null,
      grade: 10,
      gradeBands: [{ grade_min: 1, grade_max: 6, monthly_amount: 2000 }],
      playerSetting: null,
    });
    expect(amount).toBeNull();
  });

  it("選手ごと個別指定方式は個別設定が無ければnull(基準額が無いため)", () => {
    const amount = resolveMonthlyAmount({
      pricingMethod: "per_player",
      flatMonthlyAmount: null,
      grade: 3,
      gradeBands: [],
      playerSetting: null,
    });
    expect(amount).toBeNull();
  });

  it("選手ごと個別指定方式は個別設定の金額をそのまま使う", () => {
    const amount = resolveMonthlyAmount({
      pricingMethod: "per_player",
      flatMonthlyAmount: null,
      grade: 3,
      gradeBands: [],
      playerSetting: { monthly_amount: 3000, exempt: false, start_date: null, stop_date: null },
    });
    expect(amount).toBe(3000);
  });
});

describe("isPlayerBillableForPeriod", () => {
  const period = { periodStart: "2026-07-01", periodEnd: "2026-09-30" };

  it("設定が無ければ常に対象", () => {
    expect(isPlayerBillableForPeriod(period, null)).toBe(true);
  });

  it("開始月が期間の終わりより後なら対象外", () => {
    expect(isPlayerBillableForPeriod(period, { start_date: "2026-10-01", stop_date: null })).toBe(false);
  });

  it("停止月が期間の始まりより前なら対象外", () => {
    expect(isPlayerBillableForPeriod(period, { start_date: null, stop_date: "2026-06-30" })).toBe(false);
  });

  it("期間の途中に開始・停止があっても満額対象(日割りしない方針)", () => {
    expect(isPlayerBillableForPeriod(period, { start_date: "2026-08-15", stop_date: null })).toBe(true);
    expect(isPlayerBillableForPeriod(period, { start_date: null, stop_date: "2026-08-15" })).toBe(true);
  });
});

describe("duesPeriodLabel", () => {
  it("1か月の期間は「○月分」", () => {
    expect(duesPeriodLabel({ periodStart: "2026-04-01", periodEnd: "2026-04-30" })).toBe("4月分");
  });

  it("複数月の期間は「○〜○月分」", () => {
    expect(duesPeriodLabel({ periodStart: "2026-04-01", periodEnd: "2026-06-30" })).toBe("4〜6月分");
  });
});
