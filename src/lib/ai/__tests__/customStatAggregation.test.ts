import { describe, expect, it } from "vitest";
import { aggregateCategoryMatchForAi, aggregateCategorySeasonForAi, type CategoryEntry } from "../customStatAggregation";

// サッカー/Pro AI Plusのseedを単純化したフィクスチャ:
// 得点(SUM): MF=1,1,2,2,3(全5試合) / FW=1,2(第1,2試合のみ) / GKは記録なし
const goalsAllPlayers: CategoryEntry[] = [
  { match_id: "m1", player_id: "mf", value: 1 },
  { match_id: "m1", player_id: "fw", value: 1 },
  { match_id: "m2", player_id: "mf", value: 1 },
  { match_id: "m2", player_id: "fw", value: 2 },
  { match_id: "m3", player_id: "mf", value: 2 },
  { match_id: "m4", player_id: "mf", value: 2 },
  { match_id: "m5", player_id: "mf", value: 3 },
];

describe("aggregateCategorySeasonForAi", () => {
  describe("SUM", () => {
    it("複数選手の記録を全試合分合計し、記録試合の合計値平均を出す(サッカーseed相当)", () => {
      const result = aggregateCategorySeasonForAi(goalsAllPlayers, "SUM");
      expect(result.seasonTotal).toBe(12);
      expect(result.recordedGameCount).toBe(5);
      expect(result.seasonAverage).toBe(2.4);
      expect(result.recordedEntryCount).toBe(7);
      expect(result.recordedPlayerCount).toBe(2);
    });

    it("一部選手が欠損していても、記録された値だけを合計する(欠損を0にしない)", () => {
      // FWがそもそも一切スタッツを持たない年度でも、MFの記録だけで正しく合計される
      const mfOnly: CategoryEntry[] = goalsAllPlayers.filter((e) => e.player_id === "mf");
      const result = aggregateCategorySeasonForAi(mfOnly, "SUM");
      expect(result.seasonTotal).toBe(9); // 1+1+2+2+3
      expect(result.seasonAverage).toBe(1.8); // 9/5試合
    });

    it("一部試合が欠損している場合、記録のある試合だけを平均の分母にする(0を挟まない)", () => {
      // 5試合中、第3試合だけ記録がない: 2,3,(記録なし),2,3 → (2+3+2+3)/4 = 2.5
      const withGap: CategoryEntry[] = [
        { match_id: "m1", player_id: "a", value: 2 },
        { match_id: "m2", player_id: "a", value: 3 },
        { match_id: "m4", player_id: "a", value: 2 },
        { match_id: "m5", player_id: "a", value: 3 },
      ];
      const result = aggregateCategorySeasonForAi(withGap, "SUM");
      expect(result.seasonTotal).toBe(10);
      expect(result.recordedGameCount).toBe(4);
      expect(result.seasonAverage).toBe(2.5);
    });
  });

  describe("AVERAGE", () => {
    it("記録済みエントリのみの単純平均を返し、合計は算出しない", () => {
      // 走行距離: MFのみ、5試合中1試合欠損(9.5, 9.8, 欠損, 10.1, 9.6)
      const distance: CategoryEntry[] = [
        { match_id: "m1", player_id: "mf", value: 9.5 },
        { match_id: "m2", player_id: "mf", value: 9.8 },
        { match_id: "m4", player_id: "mf", value: 10.1 },
        { match_id: "m5", player_id: "mf", value: 9.6 },
      ];
      const result = aggregateCategorySeasonForAi(distance, "AVERAGE");
      expect(result.seasonTotal).toBeNull();
      expect(result.seasonAverage).toBe(9.8); // (9.5+9.8+10.1+9.6)/4、欠損試合を0にしない
      expect(result.recordedEntryCount).toBe(4);
    });

    it("欠損選手を0として分母に含めない(記録のある選手だけの平均になる)", () => {
      // 3選手中、記録があるのは2名のみ。3名で割ってはいけない。
      const entries: CategoryEntry[] = [
        { match_id: "m1", player_id: "a", value: 10 },
        { match_id: "m1", player_id: "b", value: 20 },
      ];
      const result = aggregateCategorySeasonForAi(entries, "AVERAGE");
      expect(result.seasonAverage).toBe(15); // (10+20)/2、3人目を0として/3にしない
      expect(result.recordedPlayerCount).toBe(2);
    });
  });

  describe("RATE", () => {
    it("複数選手の率を単純平均する(正確なチーム率ではない参考値として)", () => {
      const entries: CategoryEntry[] = [
        { match_id: "m1", player_id: "a", value: 60 },
        { match_id: "m1", player_id: "b", value: 80 },
      ];
      const result = aggregateCategorySeasonForAi(entries, "RATE");
      expect(result.seasonAverage).toBe(70);
      expect(result.seasonTotal).toBeNull(); // %の合計には意味がないため常にnull
    });

    it("1名のみの記録の場合、recordedPlayerCountが1になり後段で参考値扱いできる", () => {
      const duelRate: CategoryEntry[] = [
        { match_id: "m1", player_id: "mf", value: 60 },
        { match_id: "m2", player_id: "mf", value: 65 },
        { match_id: "m3", player_id: "mf", value: 55 },
        { match_id: "m4", player_id: "mf", value: 50 },
        { match_id: "m5", player_id: "mf", value: 45 },
      ];
      const result = aggregateCategorySeasonForAi(duelRate, "RATE");
      expect(result.recordedPlayerCount).toBe(1);
      expect(result.seasonAverage).toBe(55);
      expect(result.seasonTotal).toBeNull();
    });
  });

  describe("NEUTRAL / 未設定", () => {
    it("NEUTRALはチーム合計・平均を自動生成しない(常にnull)", () => {
      const entries: CategoryEntry[] = [
        { match_id: "m1", player_id: "a", value: 40 },
        { match_id: "m2", player_id: "a", value: 50 },
      ];
      const result = aggregateCategorySeasonForAi(entries, "NEUTRAL");
      expect(result.seasonTotal).toBeNull();
      expect(result.seasonAverage).toBeNull();
      // 記録件数などの生の情報は引き続き数えている(集計値だけを作らない)
      expect(result.recordedEntryCount).toBe(2);
    });

    it("aggregation_type未設定(null)も、集計方法をシステム側で推測せずnullのまま扱う", () => {
      const entries: CategoryEntry[] = [{ match_id: "m1", player_id: "a", value: 40 }];
      const result = aggregateCategorySeasonForAi(entries, null);
      expect(result.seasonTotal).toBeNull();
      expect(result.seasonAverage).toBeNull();
    });
  });

  describe("null/undefinedを0として扱わない共通の確認", () => {
    it("記録が1件もないカテゴリはすべての集計値がnullになる(0にはならない)", () => {
      const result = aggregateCategorySeasonForAi([], "SUM");
      expect(result.seasonTotal).toBeNull();
      expect(result.seasonAverage).toBeNull();
      expect(result.recordedEntryCount).toBe(0);
      expect(result.recordedGameCount).toBe(0);
      expect(result.recordedPlayerCount).toBe(0);
    });
  });
});

describe("aggregateCategoryMatchForAi", () => {
  it("SUM: 同じ試合の複数選手の値を合計する(平均にしない)", () => {
    // 第1試合: MF1点 + FW1点 → チーム値2点(1.0という平均値にはしない)
    const m1 = goalsAllPlayers.filter((e) => e.match_id === "m1");
    const result = aggregateCategoryMatchForAi(m1, "SUM");
    expect(result).toEqual({ kind: "aggregated", value: 2, recordedCount: 2 });
  });

  it("SUM: 1名しか記録がない試合はその値をそのまま合計値として扱う", () => {
    const m3 = goalsAllPlayers.filter((e) => e.match_id === "m3");
    const result = aggregateCategoryMatchForAi(m3, "SUM");
    expect(result).toEqual({ kind: "aggregated", value: 2, recordedCount: 1 });
  });

  it("試合ごとのSUM値がサッカーseed全体で2→3→2→2→3になる", () => {
    const sequence = ["m1", "m2", "m3", "m4", "m5"].map((matchId) => {
      const entries = goalsAllPlayers.filter((e) => e.match_id === matchId);
      const result = aggregateCategoryMatchForAi(entries, "SUM");
      return result?.kind === "aggregated" ? result.value : undefined;
    });
    expect(sequence).toEqual([2, 3, 2, 2, 3]);
  });

  it("AVERAGE/RATE: 記録した選手の値を単純平均する", () => {
    const entries: CategoryEntry[] = [
      { match_id: "m1", player_id: "a", value: 60 },
      { match_id: "m1", player_id: "b", value: 80 },
    ];
    const result = aggregateCategoryMatchForAi(entries, "RATE");
    expect(result).toEqual({ kind: "aggregated", value: 70, recordedCount: 2 });
  });

  it("NEUTRAL/未設定: 自動集計せず、記録された生の値をそのまま返す", () => {
    const entries: CategoryEntry[] = [
      { match_id: "m1", player_id: "a", value: 40 },
      { match_id: "m1", player_id: "b", value: 55 },
    ];
    expect(aggregateCategoryMatchForAi(entries, "NEUTRAL")).toEqual({
      kind: "raw",
      rawValues: [40, 55],
      recordedCount: 2,
    });
    expect(aggregateCategoryMatchForAi(entries, null)).toEqual({
      kind: "raw",
      rawValues: [40, 55],
      recordedCount: 2,
    });
  });

  it("このカテゴリの記録が1件もない試合はnullを返す(0扱いしない)", () => {
    expect(aggregateCategoryMatchForAi([], "SUM")).toBeNull();
    expect(aggregateCategoryMatchForAi([], "AVERAGE")).toBeNull();
    expect(aggregateCategoryMatchForAi([], "NEUTRAL")).toBeNull();
  });
});
