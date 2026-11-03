import { describe, expect, it } from "vitest";
import { duesGridStatus, sortDuesPlayers } from "./duesGrid";

describe("duesGridStatus", () => {
  const periods = [
    { id: "april", period_start: "2026-04-01", period_end: "2026-07-31" },
    { id: "august", period_start: "2026-08-01", period_end: "2026-10-31" },
  ];
  const charges = [
    { billing_period_id: "april", player_id: "a", status: "paid" },
    { billing_period_id: "august", player_id: "a", status: "unpaid" },
  ];
  it("shows paid only for paid collection month", () => {
    expect(duesGridStatus("a", 4, periods, charges)).toBe("paid");
    expect(duesGridStatus("a", 8, periods, charges)).toBe("unpaid");
  });
  it("does not show charges in months without a collection", () => {
    expect(duesGridStatus("a", 5, periods, charges)).toBe("none");
    expect(duesGridStatus("b", 4, periods, charges)).toBe("none");
  });
  it("prioritizes unpaid when multiple charges exist", () => {
    expect(duesGridStatus("a", 4, periods, [...charges, { billing_period_id: "april", player_id: "a", status: "unpaid" }])).toBe("unpaid");
  });
});

describe("sortDuesPlayers", () => {
  it("orders by grade descending and jersey ascending, unset last", () => {
    const input = [
      { id: "a", grade: "5", jersey_number: null },
      { id: "b", grade: "6", jersey_number: 12 },
      { id: "c", grade: "5", jersey_number: 3 },
      { id: "d", grade: "6", jersey_number: 2 },
    ];
    expect(sortDuesPlayers(input).map(p => p.id)).toEqual(["d", "b", "c", "a"]);
  });
});
