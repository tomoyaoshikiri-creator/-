import { describe, expect, it } from "vitest";
import {
  isDrillComplete,
  nextShotCategory,
  shotCategoryForIndex,
  summarizeShots,
  totalPointsFromCounts,
} from "../shootingDrill";

describe("shotCategoryForIndex", () => {
  it("3P→ミドル→ゴール下の順で繰り返す", () => {
    expect(shotCategoryForIndex(0)).toBe("three");
    expect(shotCategoryForIndex(1)).toBe("mid");
    expect(shotCategoryForIndex(2)).toBe("layup");
    expect(shotCategoryForIndex(3)).toBe("three");
    expect(shotCategoryForIndex(9)).toBe("three");
  });
});

describe("nextShotCategory", () => {
  it("まだ0本も打っていなければ3Pから", () => {
    expect(nextShotCategory([])).toBe("three");
  });

  it("外しても次の種類へ進む(打ち直さない)", () => {
    expect(nextShotCategory([false])).toBe("mid");
    expect(nextShotCategory([false, false])).toBe("layup");
  });
});

describe("summarizeShots", () => {
  it("目標21点で全部成功した場合、10本目(4セット目の3P)で21点になる", () => {
    const shots = Array(10).fill(true);
    const summary = summarizeShots(shots);
    expect(summary.total_points).toBe(21);
    expect(summary.three_made).toBe(4);
    expect(summary.three_att).toBe(4);
    expect(summary.mid_made).toBe(3);
    expect(summary.layup_made).toBe(3);
  });

  it("18点の状態で3Pを外し、ミドルが成功すると20点", () => {
    // 18点 = 3P成功4本(12点)+ミドル成功3本(6点) = 9本(index0-8)まで消化済みの状態を再現する。
    const shots = [true, true, true, true, true, true, true, true, true];
    expect(summarizeShots(shots).total_points).toBe(18);
    const afterMiss = [...shots, false]; // 10本目(3P)を外す
    expect(summarizeShots(afterMiss).total_points).toBe(18);
    const afterMidMake = [...afterMiss, true]; // 11本目(ミドル)成功
    expect(summarizeShots(afterMidMake).total_points).toBe(20);
  });

  it("本数が0でも全項目0として返す", () => {
    expect(summarizeShots([])).toEqual({
      three_made: 0,
      three_att: 0,
      mid_made: 0,
      mid_att: 0,
      layup_made: 0,
      layup_att: 0,
      total_points: 0,
    });
  });
});

describe("isDrillComplete", () => {
  it("合計が目標点に到達した時点でtrue(目標点ちょうどでなくてよい)", () => {
    const shots18 = [true, true, true, true, true, true, true, true, true];
    expect(isDrillComplete(shots18, 21)).toBe(false);
    const shots20 = [...shots18, false, true]; // 18 -> 3P外す(18) -> ミドル成功(20)
    expect(isDrillComplete(shots20, 21)).toBe(false);
    const shots21 = [...shots20, true]; // ゴール下成功(21)
    expect(isDrillComplete(shots21, 21)).toBe(true);
  });

  it("目標点を超えていてもtrue", () => {
    expect(isDrillComplete(Array(11).fill(true), 21)).toBe(true);
  });
});

describe("totalPointsFromCounts", () => {
  it("DB側の生成列(three_made*3 + mid_made*2 + layup_made)と同じ式で算出する", () => {
    expect(totalPointsFromCounts({ three_made: 4, mid_made: 3, layup_made: 2 })).toBe(20);
    expect(totalPointsFromCounts({ three_made: 0, mid_made: 0, layup_made: 0 })).toBe(0);
  });
});
