import { describe, expect, it } from "vitest";
import {
  annualDuesDueForPlayer, annualDuesTotal, billableFiscalMonths, collectionDates,
  validateAnnualDuesSchedule, type AnnualDuesSchedule,
} from "./duesAnnualSchedule";

const base: AnnualDuesSchedule = {
  amountPerCollection: 2500,
  annualCount: 12,
  collectionMonths: [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3],
  joinLeaveRule: "prorated",
};

describe("年間回数と集金月", () => {
  it("12回なら年間30,000円", () => {
    expect(annualDuesTotal(base)).toBe(30000);
  });
  it("6回は任意の6か月を選べ、年度順に並ぶ", () => {
    const schedule = { ...base, annualCount: 6, collectionMonths: [2, 7, 4, 12, 9, 5] };
    expect(collectionDates(schedule, 2026)).toEqual([
      "2026-04-01", "2026-05-01", "2026-07-01", "2026-09-01", "2026-12-01", "2027-02-01",
    ]);
  });
  it("集金月が不足・重複するとエラー", () => {
    expect(validateAnnualDuesSchedule({ ...base, annualCount: 3, collectionMonths: [4, 7] })).toHaveLength(1);
    expect(validateAnnualDuesSchedule({ ...base, annualCount: 3, collectionMonths: [4, 4, 7] })).toHaveLength(1);
  });
  it("1回の金額に小数や負数は不可", () => {
    expect(validateAnnualDuesSchedule({ ...base, amountPerCollection: 1.5 })).not.toHaveLength(0);
    expect(validateAnnualDuesSchedule({ ...base, amountPerCollection: -1 })).not.toHaveLength(0);
  });
});

describe("途中加入・退団", () => {
  it("7月加入は9か月分の22,500円", () => {
    expect(annualDuesDueForPlayer(base, 2026, "2026-07-15", null)).toBe(22500);
  });
  it("7月加入でも全額請求を選べる", () => {
    expect(annualDuesDueForPlayer({ ...base, joinLeaveRule: "full" }, 2026, "2026-07-15", null)).toBe(30000);
  });
  it("年度外の在籍は0円", () => {
    expect(annualDuesDueForPlayer({ ...base, joinLeaveRule: "full" }, 2026, "2027-04-01", null)).toBe(0);
  });
  it("途中退団は終了月を含む", () => {
    expect(billableFiscalMonths(2026, null, "2026-06-01")).toEqual([4, 5, 6]);
  });
  it("不正な日付は拒否", () => {
    expect(() => billableFiscalMonths(2026, "2026-02-30", null)).toThrow();
  });
});
