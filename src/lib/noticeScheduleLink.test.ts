import { describe, expect, it } from "vitest";
import { isRelatedScheduleError, resolveAutoFillMonth, sortNoticesByRelatedSchedule } from "./noticeScheduleLink";
import type { Schedule } from "./database.types";

function schedule(date: string): Pick<Schedule, "date"> {
  return { date };
}

describe("isRelatedScheduleError", () => {
  it("returns true for a foreign-key violation (schedule deleted)", () => {
    expect(isRelatedScheduleError({ code: "23503", message: "violates foreign key constraint" })).toBe(true);
  });

  it("returns true for the cross-team validation trigger's message", () => {
    expect(isRelatedScheduleError({ message: "RELATED_SCHEDULE_INVALID: ..." })).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isRelatedScheduleError({ code: "23505", message: "duplicate key value" })).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isRelatedScheduleError(null)).toBe(false);
    expect(isRelatedScheduleError(undefined)).toBe(false);
  });
});

describe("resolveAutoFillMonth", () => {
  const picked = { id: "s1", date: "2026-12-10" } as Schedule;

  it("auto-fills on the first ever selection when the month was not manually changed", () => {
    expect(
      resolveAutoFillMonth({ prevRelatedScheduleId: null, manuallyChangedMonth: false, newSchedule: picked }),
    ).toBe("2026-12");
  });

  it("does not auto-fill when the user already manually changed the month", () => {
    expect(
      resolveAutoFillMonth({ prevRelatedScheduleId: null, manuallyChangedMonth: true, newSchedule: picked }),
    ).toBeNull();
  });

  it("does not auto-fill when replacing an already-selected schedule with a different one", () => {
    expect(
      resolveAutoFillMonth({ prevRelatedScheduleId: "other", manuallyChangedMonth: false, newSchedule: picked }),
    ).toBeNull();
  });

  it("does not auto-fill when unlinking (selecting 紐づけなし)", () => {
    expect(
      resolveAutoFillMonth({ prevRelatedScheduleId: "s1", manuallyChangedMonth: false, newSchedule: null }),
    ).toBeNull();
  });
});

describe("sortNoticesByRelatedSchedule", () => {
  const today = "2026-11-10";
  const schedulesById: Record<string, Pick<Schedule, "date">> = {
    future1: schedule("2026-11-15"),
    future2: schedule("2026-11-20"),
    todaySched: schedule("2026-11-10"),
    past1: schedule("2026-11-05"),
    past2: schedule("2026-10-01"),
  };

  it("groups: future/today first, then no-schedule, then past", () => {
    const notices = [
      { id: "n-past", related_schedule_id: "past1", created_at: "2026-11-01T00:00:00Z" },
      { id: "n-none", related_schedule_id: null, created_at: "2026-11-02T00:00:00Z" },
      { id: "n-future", related_schedule_id: "future1", created_at: "2026-11-03T00:00:00Z" },
    ];
    const sorted = sortNoticesByRelatedSchedule(notices, schedulesById, today);
    expect(sorted.map((n) => n.id)).toEqual(["n-future", "n-none", "n-past"]);
  });

  it("treats a schedule occurring today as group 1 (not past)", () => {
    const notices = [
      { id: "n-today", related_schedule_id: "todaySched", created_at: "2026-11-01T00:00:00Z" },
      { id: "n-none", related_schedule_id: null, created_at: "2026-11-02T00:00:00Z" },
    ];
    const sorted = sortNoticesByRelatedSchedule(notices, schedulesById, today);
    expect(sorted.map((n) => n.id)).toEqual(["n-today", "n-none"]);
  });

  it("within group 1, sorts by schedule date ascending, tie-broken by notice created_at descending", () => {
    const notices = [
      { id: "n-future2", related_schedule_id: "future2", created_at: "2026-11-01T00:00:00Z" },
      { id: "n-future1-old", related_schedule_id: "future1", created_at: "2026-11-01T00:00:00Z" },
      { id: "n-future1-new", related_schedule_id: "future1", created_at: "2026-11-05T00:00:00Z" },
    ];
    const sorted = sortNoticesByRelatedSchedule(notices, schedulesById, today);
    // future1 (11-15) before future2 (11-20); within future1, newer created_at first.
    expect(sorted.map((n) => n.id)).toEqual(["n-future1-new", "n-future1-old", "n-future2"]);
  });

  it("within group 3 (past), sorts by schedule date descending, tie-broken by notice created_at descending", () => {
    const notices = [
      { id: "n-past2", related_schedule_id: "past2", created_at: "2026-11-01T00:00:00Z" },
      { id: "n-past1", related_schedule_id: "past1", created_at: "2026-11-01T00:00:00Z" },
    ];
    const sorted = sortNoticesByRelatedSchedule(notices, schedulesById, today);
    // past1 (11-05) is more recent than past2 (10-01), so past1 comes first in group 3.
    expect(sorted.map((n) => n.id)).toEqual(["n-past1", "n-past2"]);
  });

  it("within group 2 (no schedule), sorts by notice created_at descending", () => {
    const notices = [
      { id: "n-old", related_schedule_id: null, created_at: "2026-11-01T00:00:00Z" },
      { id: "n-new", related_schedule_id: null, created_at: "2026-11-05T00:00:00Z" },
    ];
    const sorted = sortNoticesByRelatedSchedule(notices, schedulesById, today);
    expect(sorted.map((n) => n.id)).toEqual(["n-new", "n-old"]);
  });

  it("treats a related schedule with a missing/undated lookup as group 2 (defensive)", () => {
    const notices = [
      { id: "n-dangling", related_schedule_id: "does-not-exist", created_at: "2026-11-01T00:00:00Z" },
      { id: "n-future", related_schedule_id: "future1", created_at: "2026-11-01T00:00:00Z" },
    ];
    const sorted = sortNoticesByRelatedSchedule(notices, schedulesById, today);
    expect(sorted.map((n) => n.id)).toEqual(["n-future", "n-dangling"]);
  });

  it("falls back to id ascending as the final tie-break", () => {
    const notices = [
      { id: "b", related_schedule_id: null, created_at: "2026-11-01T00:00:00Z" },
      { id: "a", related_schedule_id: null, created_at: "2026-11-01T00:00:00Z" },
    ];
    const sorted = sortNoticesByRelatedSchedule(notices, schedulesById, today);
    expect(sorted.map((n) => n.id)).toEqual(["a", "b"]);
  });
});
