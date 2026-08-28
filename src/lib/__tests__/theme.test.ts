import { describe, expect, it } from "vitest";
import {
  BRAND_BLUE,
  BRAND_CYAN,
  contrastRatio,
  isValidHexColor,
  onColorFor,
  relativeLuminance,
  resolveTeamTheme,
  teamThemeStyle,
} from "../theme";

// onColorFor: 単純な「常に白」ではなく、WCAG相対輝度ベースのコントラスト比で
// 濃色(--ink相当)/白のうちコントラストが高い方を選ぶことを確認する。
describe("onColorFor", () => {
  it("濃いチームカラーの上では白系文字を選ぶ", () => {
    expect(onColorFor("#0a0a2a")).toBe("#ffffff");
  });

  it("明るいチームカラーの上では濃色文字を選ぶ", () => {
    expect(onColorFor("#f5f5f0")).toBe("#1a1a1a");
  });

  it("白に近いカラーの上では濃色文字を選ぶ", () => {
    expect(onColorFor("#fefefe")).toBe("#1a1a1a");
  });

  it("黒に近いカラーの上では白系文字を選ぶ", () => {
    expect(onColorFor("#050505")).toBe("#ffffff");
  });

  it("未設定(null/undefined)の場合はBrand Blueを背景とみなして安全にfallbackする", () => {
    expect(onColorFor(null)).toBe(onColorFor(BRAND_BLUE));
    expect(onColorFor(undefined)).toBe(onColorFor(BRAND_BLUE));
  });

  it("不正なカラー値の場合もBrand Blueを背景とみなして安全にfallbackする", () => {
    expect(onColorFor("not-a-color")).toBe(onColorFor(BRAND_BLUE));
    expect(onColorFor("")).toBe(onColorFor(BRAND_BLUE));
    expect(onColorFor("#12")).toBe(onColorFor(BRAND_BLUE));
  });
});

describe("isValidHexColor", () => {
  it("3桁・6桁hexを妥当な値として受理する", () => {
    expect(isValidHexColor("#fff")).toBe(true);
    expect(isValidHexColor("#ffffff")).toBe(true);
    expect(isValidHexColor("#087CF0")).toBe(true);
  });

  it("hex形式でない値・null・undefinedを不正値として扱う", () => {
    expect(isValidHexColor("087CF0")).toBe(false);
    expect(isValidHexColor("#12")).toBe(false);
    expect(isValidHexColor("red")).toBe(false);
    expect(isValidHexColor(null)).toBe(false);
    expect(isValidHexColor(undefined)).toBe(false);
    expect(isValidHexColor("")).toBe(false);
  });
});

describe("relativeLuminance/contrastRatio", () => {
  it("白は黒より相対輝度が高い", () => {
    expect(relativeLuminance("#ffffff")).toBeGreaterThan(relativeLuminance("#000000"));
  });

  it("白と黒のコントラスト比は21:1(WCAGの最大値)", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 1);
  });

  it("同色同士のコントラスト比は1:1", () => {
    expect(contrastRatio(BRAND_BLUE, BRAND_BLUE)).toBeCloseTo(1, 5);
  });
});

// resolveTeamTheme: チームカラー設定済み/未設定/不正値それぞれのfallback仕様を確認する。
describe("resolveTeamTheme", () => {
  it("チームカラー設定済みの場合はそのまま反映する", () => {
    const tokens = resolveTeamTheme({ themePrimary: "#c0392b", themeAccent: "#f7d94c" });
    expect(tokens.teamPrimary).toBe("#c0392b");
    expect(tokens.teamSecondary).toBe("#f7d94c");
    expect(tokens.onTeamPrimary).toBe("#ffffff");
    expect(tokens.onTeamSecondary).toBe("#1a1a1a");
  });

  it("チームカラー未設定(null)の場合はCIRCLE LINESブランドカラーへfallbackする", () => {
    const tokens = resolveTeamTheme({ themePrimary: null, themeAccent: null });
    expect(tokens.teamPrimary).toBe(BRAND_BLUE);
    expect(tokens.teamSecondary).toBe(BRAND_CYAN);
  });

  it("チームカラー未指定(undefined)の場合もfallbackする", () => {
    const tokens = resolveTeamTheme({});
    expect(tokens.teamPrimary).toBe(BRAND_BLUE);
    expect(tokens.teamSecondary).toBe(BRAND_CYAN);
  });

  it("不正なカラー値の場合も安全にfallbackする", () => {
    const tokens = resolveTeamTheme({ themePrimary: "invalid", themeAccent: "#zzzzzz" });
    expect(tokens.teamPrimary).toBe(BRAND_BLUE);
    expect(tokens.teamSecondary).toBe(BRAND_CYAN);
  });
});

// teamThemeStyle: 旧token(--orange/--navy)を導入前と全く同じ条件(truthy値なら
// 妥当性チェックなしでそのまま代入)で維持しつつ、新tokenも常に安全な値を持つことを確認する。
describe("teamThemeStyle", () => {
  it("チームカラー設定済みの場合、旧token・新tokenの両方を返す", () => {
    const style = teamThemeStyle({ themePrimary: "#c0392b", themeAccent: "#f7d94c" });
    expect(style["--orange"]).toBe("#c0392b");
    expect(style["--navy"]).toBe("#f7d94c");
    expect(style["--team-primary"]).toBe("#c0392b");
    expect(style["--team-secondary"]).toBe("#f7d94c");
    expect(style["--on-team-primary"]).toBe("#ffffff");
    expect(style["--on-team-secondary"]).toBe("#1a1a1a");
  });

  it("チームカラー未設定の場合、旧tokenは注入せず新tokenのみブランドカラーで提供する(既存挙動の完全維持)", () => {
    const style = teamThemeStyle({ themePrimary: null, themeAccent: null });
    expect(style["--orange"]).toBeUndefined();
    expect(style["--navy"]).toBeUndefined();
    expect(style["--team-primary"]).toBe(BRAND_BLUE);
    expect(style["--team-secondary"]).toBe(BRAND_CYAN);
  });

  it("不正な値でも旧tokenは(既存互換のため)そのまま代入され、新tokenだけが安全にfallbackする", () => {
    const style = teamThemeStyle({ themePrimary: "invalid-value", themeAccent: undefined });
    expect(style["--orange"]).toBe("invalid-value");
    expect(style["--navy"]).toBeUndefined();
    expect(style["--team-primary"]).toBe(BRAND_BLUE);
  });
});
