import { describe, expect, it } from "vitest";
import { countBasketballTeamGames, matchResult } from "../collect";

// 通常バスケットボール/ミニバスケットボールのチーム分析で、AIへ渡すgameCountが
// 「出場記録のある選手数」(computeTeamAverages()のgp)ではなく、実際のユニークな
// 試合数から算出されることを直接保護する回帰テスト。
describe("countBasketballTeamGames", () => {
  it("2選手が全3試合に出場していても、試合数は3になる(選手数の2にならない)", () => {
    const lines = [
      { match_id: "m1", player_id: "haruto" },
      { match_id: "m2", player_id: "haruto" },
      { match_id: "m3", player_id: "haruto" },
      { match_id: "m1", player_id: "yamato" },
      { match_id: "m2", player_id: "yamato" },
      { match_id: "m3", player_id: "yamato" },
    ];
    expect(countBasketballTeamGames(lines)).toBe(3);
  });

  it("選手ごとに出場試合が異なっていても、チーム全体のユニークな試合数を数える", () => {
    const lines = [
      { match_id: "m1", player_id: "a" },
      { match_id: "m2", player_id: "a" },
      { match_id: "m2", player_id: "b" },
      { match_id: "m3", player_id: "b" },
    ];
    expect(countBasketballTeamGames(lines)).toBe(3);
  });

  it("記録が0件なら試合数も0", () => {
    expect(countBasketballTeamGames([])).toBe(0);
  });
});

// AI分析(直接分析・分析用抽出の両方)に試合の勝敗を含めるための判定ロジック。
describe("matchResult", () => {
  it("自チームのスコアが上回っていれば勝ち", () => {
    expect(matchResult(80, 70)).toBe("win");
  });

  it("自チームのスコアが下回っていれば負け", () => {
    expect(matchResult(60, 75)).toBe("loss");
  });

  it("同点なら引き分け", () => {
    expect(matchResult(50, 50)).toBe("draw");
  });

  it("どちらかのスコアが未記録ならnull(引き分けと区別する)", () => {
    expect(matchResult(null, 70)).toBeNull();
    expect(matchResult(80, null)).toBeNull();
    expect(matchResult(null, null)).toBeNull();
  });
});
