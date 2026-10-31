import { describe, expect, it } from "vitest";
import { BOTTOM_NAV_TABS, TAB_LABELS, TAB_PATHS, canRecordGames, tabHrefForRole } from "../permissions";
import type { Role } from "../database.types";

const ALL_ROLES: Role[] = ["一般", "運営", "指導者", "管理者"];

// Phase 3(共通ナビゲーション刷新)でTabBarをピル型デザインへ作り直した際、
// 表示するタブの構成(キー・順序)とロール別の遷移先ロジックは変更していない
// ことを確認する回帰テスト。ラベル文言(TAB_LABELS)だけが今回の変更対象。
// BOTTOM_NAV_TABSはROLE_TABS/canAccessTab(ページ単体のルートガード専用)とは
// 無関係に、ロールを問わず常に同じ5タブがTabBar.tsxに表示される(既存仕様)。
describe("BOTTOM_NAV_TABS", () => {
  it("ホーム・スケジュール・NEWS・ゲーム・チームの5タブ、この順序で固定である", () => {
    expect(BOTTOM_NAV_TABS).toEqual(["home", "schedule", "notice", "game", "team"]);
  });
});

describe("TAB_LABELS(ボトムナビ表記)", () => {
  it("Phase 3で確定した表記になっている", () => {
    expect(TAB_LABELS.home).toBe("ホーム");
    expect(TAB_LABELS.schedule).toBe("スケジュール");
    expect(TAB_LABELS.notice).toBe("NEWS");
    expect(TAB_LABELS.game).toBe("ゲーム");
    expect(TAB_LABELS.team).toBe("チーム");
  });
});

describe("tabHrefForRole", () => {
  it("試合記録ができる指導者・管理者は/gameへ遷移する", () => {
    expect(tabHrefForRole("指導者", "game")).toBe("/game");
    expect(tabHrefForRole("管理者", "game")).toBe("/game");
  });

  it("試合記録ができない一般・運営は結果閲覧専用の/game/resultsへ遷移する", () => {
    expect(tabHrefForRole("一般", "game")).toBe("/game/results");
    expect(tabHrefForRole("運営", "game")).toBe("/game/results");
  });

  it("game以外のタブは常にTAB_PATHSの固定パスへ遷移する", () => {
    for (const role of ALL_ROLES) {
      expect(tabHrefForRole(role, "home")).toBe(TAB_PATHS.home);
      expect(tabHrefForRole(role, "schedule")).toBe(TAB_PATHS.schedule);
      expect(tabHrefForRole(role, "notice")).toBe(TAB_PATHS.notice);
      expect(tabHrefForRole(role, "team")).toBe(TAB_PATHS.team);
    }
  });
});

describe("canRecordGames", () => {
  it("指導者・管理者のみ試合記録ができる", () => {
    expect(canRecordGames("指導者")).toBe(true);
    expect(canRecordGames("管理者")).toBe(true);
    expect(canRecordGames("一般")).toBe(false);
    expect(canRecordGames("運営")).toBe(false);
  });
});
