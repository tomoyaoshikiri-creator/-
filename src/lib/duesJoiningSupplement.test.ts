import { describe, expect, it } from "vitest";
import { previewJoiningSupplement } from "./duesJoiningSupplement";

const plan = { basis: "monthly" as const, amount: 2500, collectionMonths: [4, 8, 11, 2] };

describe("Joining supplement preview", () => {
  it("calculates September joiner before November collection", () => {
    expect(previewJoiningSupplement({ plan, fiscalYear: 2026, joinDate: "2026-09-20" }))
      .toEqual({ collectionMonth: 8, coveredMonths: [9, 10], amount: 5000 });
  });
  it("does not create a supplement when joining on a collection month", () => {
    expect(previewJoiningSupplement({ plan, fiscalYear: 2026, joinDate: "2026-11-03" })).toBeNull();
  });
  it("does not create a supplement for April joiner", () => {
    expect(previewJoiningSupplement({ plan, fiscalYear: 2026, joinDate: "2026-04-15" })).toBeNull();
  });
  it("calculates March joiner after February collection", () => {
    expect(previewJoiningSupplement({ plan, fiscalYear: 2026, joinDate: "2027-03-01" }))
      .toEqual({ collectionMonth: 2, coveredMonths: [3], amount: 2500 });
  });
});
