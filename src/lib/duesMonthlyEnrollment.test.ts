import { describe, expect, it } from "vitest";
import { previewMonthlyEnrollment } from "./duesMonthlyEnrollment";

const plan = { basis: "monthly" as const, amount: 2500, collectionMonths: [4, 7, 10, 1] };

describe("Monthly dues for partial enrollment", () => {
  it("bills July joiner only for July-March", () => {
    const rows = previewMonthlyEnrollment({ plan, fiscalYear: 2026, startDate: "2026-07-15", stopDate: null, fullPeriod: false });
    expect(rows.map(row => [row.collectionMonth, row.amount])).toEqual([[7, 7500], [10, 7500], [1, 7500]]);
  });
  it("prorates a May joiner within April-June collection", () => {
    const rows = previewMonthlyEnrollment({ plan, fiscalYear: 2026, startDate: "2026-05-10", stopDate: null, fullPeriod: false });
    expect(rows[0]).toMatchObject({ collectionMonth: 4, amount: 5000, coveredMonths: [5, 6] });
  });
  it("full-period mode bills full quarter for a May joiner", () => {
    const rows = previewMonthlyEnrollment({ plan, fiscalYear: 2026, startDate: "2026-05-10", stopDate: null, fullPeriod: true });
    expect(rows[0].amount).toBe(7500);
  });
  it("does not bill after a September departure", () => {
    const rows = previewMonthlyEnrollment({ plan, fiscalYear: 2026, startDate: null, stopDate: "2026-09-02", fullPeriod: false });
    expect(rows.map(row => [row.collectionMonth, row.amount])).toEqual([[4, 7500], [7, 7500]]);
  });
});
