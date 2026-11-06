import { describe, expect, it } from "vitest";
import {
  afterNoticeCursor,
  fetchAllPagesByCursor,
  isRelatedScheduleError,
  resolveAutoFillMonth,
  sortNoticesByRelatedSchedule,
} from "./noticeScheduleLink";
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

  it("maintains the 3-group order after more group-2 (no related schedule) notices are appended, as loadMore does", () => {
    const initial = [
      { id: "n-future", related_schedule_id: "future1", created_at: "2026-11-01T00:00:00Z" },
      { id: "n-none-1", related_schedule_id: null, created_at: "2026-11-05T00:00:00Z" },
      { id: "n-past", related_schedule_id: "past1", created_at: "2026-11-01T00:00:00Z" },
    ];
    // loadMore()はnotices状態へ追記するだけで、呼び出し側は毎回
    // sortNoticesByRelatedScheduleをフルの配列に対してかけ直す(ページ.tsxと同じ使い方)。
    const afterLoadMore = [...initial, { id: "n-none-2", related_schedule_id: null, created_at: "2026-11-02T00:00:00Z" }];
    const sorted = sortNoticesByRelatedSchedule(afterLoadMore, schedulesById, today);
    expect(sorted.map((n) => n.id)).toEqual(["n-future", "n-none-1", "n-none-2", "n-past"]);
  });
});

describe("afterNoticeCursor", () => {
  it("builds a PostgREST or() condition for created_at desc / id asc pagination", () => {
    expect(afterNoticeCursor("2026-11-05T00:00:00Z", "abc")).toBe(
      "created_at.lt.2026-11-05T00:00:00Z,and(created_at.eq.2026-11-05T00:00:00Z,id.gt.abc)",
    );
  });
});

describe("fetchAllPagesByCursor", () => {
  type Row = { id: string; created_at: string };

  // created_at降順・id昇順のdataset全体から、カーソル以降の行だけをbatchSize件
  // 切り出す、本物のDBクエリ(created_at.lt. OR (created_at.eq. AND id.gt.))を
  // 模したモック。afterNoticeCursor()と同じ条件をJS側で再現している。
  function makeFetchPage(dataset: Row[], batchSize: number) {
    return async (cursor: { createdAt: string; id: string } | null): Promise<Row[]> => {
      const filtered = cursor
        ? dataset.filter((r) => r.created_at < cursor.createdAt || (r.created_at === cursor.createdAt && r.id > cursor.id))
        : dataset;
      return filtered.slice(0, batchSize);
    };
  }

  it("accumulates every row across many batches (dataset larger than a single page)", async () => {
    // 201件(旧SCHEDULED_FETCH_LIMIT=200の上限を1件超える)を小さいbatchSizeで取得する。
    const dataset: Row[] = Array.from({ length: 201 }, (_, i) => ({
      id: String(i).padStart(4, "0"),
      created_at: `2026-11-${String(30 - Math.floor(i / 10)).padStart(2, "0")}T00:00:00Z`,
    })).sort((a, b) => (a.created_at === b.created_at ? (a.id < b.id ? -1 : 1) : a.created_at > b.created_at ? -1 : 1));
    const batchSize = 20;
    const result = await fetchAllPagesByCursor(makeFetchPage(dataset, batchSize), batchSize);
    expect(result).toHaveLength(201);
    expect(new Set(result.map((r) => r.id)).size).toBe(201);
    expect(result.map((r) => r.id)).toEqual(dataset.map((r) => r.id));
  });

  it("does not drop or duplicate rows that share the exact same created_at at a page boundary", async () => {
    // batchSizeちょうどの位置(インデックス2/3の境界)に同一created_atの行が
    // またがるデータセット。created_atだけのカーソルだとこの3件のうち取得済みで
    // ない分を丸ごと取りこぼす。
    const dataset: Row[] = [
      { id: "0001", created_at: "2026-11-05T00:00:00Z" },
      { id: "0002", created_at: "2026-11-05T00:00:00Z" },
      { id: "0003", created_at: "2026-11-05T00:00:00Z" }, // ties with 0001/0002, spans the boundary
      { id: "0004", created_at: "2026-11-05T00:00:00Z" },
      { id: "0005", created_at: "2026-11-04T00:00:00Z" },
    ];
    const batchSize = 2;
    const result = await fetchAllPagesByCursor(makeFetchPage(dataset, batchSize), batchSize);
    expect(result.map((r) => r.id)).toEqual(["0001", "0002", "0003", "0004", "0005"]);
  });

  it("makes a single call when the first page is already short (common case: few or no linked schedules)", async () => {
    const dataset: Row[] = [{ id: "0001", created_at: "2026-11-05T00:00:00Z" }];
    let calls = 0;
    const result = await fetchAllPagesByCursor(async (cursor) => {
      calls += 1;
      return makeFetchPage(dataset, 100)(cursor);
    }, 100);
    expect(calls).toBe(1);
    expect(result).toHaveLength(1);
  });

  it("returns an empty array without error when there is nothing to fetch", async () => {
    const result = await fetchAllPagesByCursor(makeFetchPage([], 100), 100);
    expect(result).toEqual([]);
  });
});
