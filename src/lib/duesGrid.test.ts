import { describe, expect, it } from "vitest";
import { duesGridStatus, sortDuesPlayers } from "./duesGrid";

describe("duesGridStatus", () => {
  const periods = [{ id: "april", period_start: "2026-04-01", period_end: "2026-07-31" }];
  it("returns paid for settled charges", () => {
    expect(duesGridStatus("p1", 4, periods, [{ billing_period_id: "april", player_id: "p1", status: "paid" }])).toBe("paid");
  });
  it("returns unpaid if any charge remains unpaid", () => {
    expect(duesGridStatus("p1", 4, periods, [
      { billing_period_id: "april", player_id: "p1", status: "paid" },
      { billing_period_id: "april", player_id: "p1", status: "unpaid" },
    ])).toBe("unpaid");
  });
  it("returns none without charges", () => {
    expect(duesGridStatus("p1", 5, periods, [])).toBe("none");
  });
});

describe("sortDuesPlayers", () => {
  it("sorts by descending grade and ascending roster number", () => {
    const players = [
      { id: "a", grade: "5", number: null },
      { id: "b", grade: "6", number: "12" },
      { id: "c", grade: "5", number: "3" },
      { id: "d", grade: "6", number: "2" },
    ];
    expect(sortDuesPlayers(players).map(p => p.id)).toEqual(["d", "b", "c", "a"]);
  });
});
