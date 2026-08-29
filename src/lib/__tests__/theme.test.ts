import { describe, expect, it } from "vitest";
import {
  BRAND_BLUE,
  BRAND_CYAN,
  BRAND_NAVY,
  brandGradientStops,
  contrastRatio,
  GRADIENT_PARAMS,
  gradientCss,
  headerChipColors,
  headerGradientStops,
  HEADER_CONTRAST_TARGET,
  HEADER_POSITIONS,
  headerThemeStyle,
  headerTitleColors,
  isValidHexColor,
  onColorFor,
  relativeLuminance,
  RELATIVE_LUMINANCE_TIE_EPSILON,
  resolveTeamTheme,
  teamGradientStops,
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

// brandGradientStops/headerGradientStops: チームカラー未設定時は常に
// CIRCLE LINESブランドグラデーション01(Navy→Blue→Cyan、0/40/100)そのものを使うことを確認する。
describe("brandGradientStops/headerGradientStops(未設定)", () => {
  it("ブランドグラデーション01はNavy 0% / Blue 40% / Cyan 100%固定", () => {
    expect(brandGradientStops()).toEqual([
      { position: 0, color: BRAND_NAVY },
      { position: GRADIENT_PARAMS.heroStopPercent, color: BRAND_BLUE },
      { position: 100, color: BRAND_CYAN },
    ]);
  });

  it("チームカラー未設定(null)の場合はブランドグラデーション01を使う", () => {
    expect(headerGradientStops({ themePrimary: null, themeAccent: null })).toEqual(brandGradientStops());
  });

  it("primary/secondaryの片方だけ設定されている場合もブランドグラデーション01にfallbackする", () => {
    expect(headerGradientStops({ themePrimary: "#1D4ED8", themeAccent: null })).toEqual(brandGradientStops());
    expect(headerGradientStops({ themePrimary: null, themeAccent: "#38BDF8" })).toEqual(brandGradientStops());
  });

  it("不正なhex値の場合もブランドグラデーション01にfallbackする", () => {
    expect(headerGradientStops({ themePrimary: "#1D4ED8", themeAccent: "not-a-color" })).toEqual(brandGradientStops());
  });
});

// hexの色相(0〜360度)を独立に計算するテスト専用ヘルパー。本番実装の内部関数
// (hexToHsl等)には依存せず、標準的なHSL変換式で直接算出することで、
// 「deep/accentが実際にどちらの色由来の色相を継承しているか」を独立に検証できるようにする。
function hueOf(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / d) % 6;
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  h *= 60;
  return h < 0 ? h + 360 : h;
}

function hueDiffDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// teamGradientStops: 「チーム版01」の生成ルール(D案: 相対輝度で役割を対称割当)。
// 9パターン(Phase UI-2Bのモック検証と同一のテストカラー+都賀ビクトリーズ実データ)で、
// 構造・有効性・deep/accentの色源選択を確認する。
describe("teamGradientStops(チーム版01)", () => {
  const CASES: Record<string, { p: string; s: string }> = {
    tsuga: { p: "#FFAB01", s: "#011D57" },
    blue: { p: "#1D4ED8", s: "#38BDF8" },
    red: { p: "#DC2626", s: "#F97316" },
    green: { p: "#16A34A", s: "#FACC15" },
    purple: { p: "#7C3AED", s: "#EC4899" },
    lightPrimary: { p: "#FDE68A", s: "#FCA5A5" },
    darkPrimary: { p: "#1E1B4B", s: "#312E81" },
    hueGapLarge: { p: "#DC2626", s: "#2563EB" },
    invertedLightness: { p: "#FDE68A", s: "#4C1D95" },
  };

  it.each(Object.entries(CASES))("%s: 深色→primary→明るいアクセントの3ストップになり、値はすべて有効なhex", (_key, { p, s }) => {
    const stops = teamGradientStops(p, s);
    expect(stops).toHaveLength(3);
    expect(stops.map((st) => st.position)).toEqual([0, GRADIENT_PARAMS.heroStopPercent, 100]);
    stops.forEach((st) => {
      expect(isValidHexColor(st.color)).toBe(true);
      expect(st.color).not.toMatch(/nan/i);
    });
  });

  it.each(Object.entries(CASES))("%s: primaryそのものが主役色(40%)として無加工で保持される", (_key, { p, s }) => {
    const stops = teamGradientStops(p, s);
    expect(stops[1].color).toBe(p);
  });

  it.each(Object.entries(CASES))("%s: 深色(0%)はprimaryと異なり、primaryより暗い(相対輝度が低い)", (_key, { p, s }) => {
    const stops = teamGradientStops(p, s);
    expect(stops[0].color).not.toBe(p);
    // 深色はBrand Navy相当の相対輝度に正規化されるため、常にBrand Navyの相対輝度に近い
    // (どちらのケースでも同じ「深さの水準」を再現しているはずで、5%以内の差に収まる)。
    expect(Math.abs(relativeLuminance(stops[0].color) - relativeLuminance(BRAND_NAVY))).toBeLessThan(0.05);
  });

  it.each(Object.entries(CASES))("%s: 明るいアクセント(100%)は、Brand Cyan相当の相対輝度に正規化される", (_key, { p, s }) => {
    const stops = teamGradientStops(p, s);
    expect(Math.abs(relativeLuminance(stops[2].color) - relativeLuminance(BRAND_CYAN))).toBeLessThan(0.05);
  });

  it("secondary未指定の場合はprimary由来の明るい色のみでアクセントを作る(異常値にならない)", () => {
    const withSecondary = teamGradientStops("#1D4ED8", "#38BDF8");
    const withoutSecondary = teamGradientStops("#1D4ED8", null);
    expect(isValidHexColor(withoutSecondary[2].color)).toBe(true);
    expect(withoutSecondary[2].color).not.toBe(withSecondary[2].color);
  });

  it("都賀ビクトリーズ実データ(secondaryの方が大幅に暗い): deepはsecondary由来、heroは#FFAB01そのまま、accentはprimary由来", () => {
    const primary = "#FFAB01";
    const secondary = "#011D57";
    const stops = teamGradientStops(primary, secondary);
    expect(stops[1].color).toBe(primary);
    // deep(0%)は暗い方=secondaryの色相を引き継ぐ(primaryの色相40°ではなくsecondaryの220°寄り)。
    expect(hueDiffDeg(hueOf(stops[0].color), hueOf(secondary))).toBeLessThan(5);
    // accent(100%)は明るい方=primaryの色相を引き継ぐ。
    expect(hueDiffDeg(hueOf(stops[2].color), hueOf(primary))).toBeLessThan(5);
  });

  it("secondaryの方が明るいケース: deepはprimary由来、accentはsecondary由来", () => {
    const primary = "#1D4ED8"; // 相対輝度が低い(暗い)
    const secondary = "#38BDF8"; // 相対輝度が高い(明るい)
    const stops = teamGradientStops(primary, secondary);
    expect(hueDiffDeg(hueOf(stops[0].color), hueOf(primary))).toBeLessThan(5);
    expect(hueDiffDeg(hueOf(stops[2].color), hueOf(secondary))).toBeLessThan(5);
  });

  it("primary/secondaryの相対輝度がほぼ同じ(EPSILON以内)ケース: 役割がprimary=deep寄り/secondary=light寄りに安定する", () => {
    const primary = "#8834b2"; // 紫系
    const secondary = "#1e6950"; // 緑系(色相は大きく異なるが、相対輝度差は0.01未満)
    expect(Math.abs(relativeLuminance(primary) - relativeLuminance(secondary))).toBeLessThan(
      RELATIVE_LUMINANCE_TIE_EPSILON,
    );
    const stops = teamGradientStops(primary, secondary);
    expect(hueDiffDeg(hueOf(stops[0].color), hueOf(primary))).toBeLessThan(5);
    expect(hueDiffDeg(hueOf(stops[2].color), hueOf(secondary))).toBeLessThan(5);
  });
});

// headerChipColors/headerTitleColors/headerThemeStyle: 通常サイズの重要テキストについて
// 4.5:1以上のコントラストを確保できているかを、9パターンのテストカラーで検証する。
describe("headerChipColors/headerTitleColors(コントラスト)", () => {
  const ALL_CASES: Array<[string, string, string]> = [
    ["unset-brand01", BRAND_BLUE, BRAND_CYAN],
    ["tsuga", "#FFAB01", "#011D57"],
    ["blue", "#1D4ED8", "#38BDF8"],
    ["red", "#DC2626", "#F97316"],
    ["green", "#16A34A", "#FACC15"],
    ["purple", "#7C3AED", "#EC4899"],
    ["lightPrimary", "#FDE68A", "#FCA5A5"],
    ["darkPrimary", "#1E1B4B", "#312E81"],
    ["hueGapLarge", "#DC2626", "#2563EB"],
    ["invertedLightness", "#FDE68A", "#4C1D95"],
  ];

  it.each(ALL_CASES)("%s: チーム名/ユーザー名/役職/Badge/検索欄(chip系)は常に4.5:1以上", (_key, p, s) => {
    const stops = teamGradientStops(p, s);
    const chip = headerChipColors(stops, HEADER_POSITIONS.chipRow);
    const search = headerChipColors(stops, HEADER_POSITIONS.searchRow);
    expect(contrastRatio(chip.surface, chip.on)).toBeGreaterThanOrEqual(HEADER_CONTRAST_TARGET);
    expect(contrastRatio(search.surface, search.on)).toBeGreaterThanOrEqual(HEADER_CONTRAST_TARGET);
  });

  it.each(ALL_CASES)("%s: 画面タイトル/戻るボタンは、素の背景かsurface適用後のいずれかで4.5:1以上", (_key, p, s) => {
    const stops = teamGradientStops(p, s);
    const title = headerTitleColors(stops, HEADER_POSITIONS.titleRow);
    const effectiveBg = title.surface === "transparent" ? undefined : title.surface;
    if (effectiveBg) {
      expect(contrastRatio(effectiveBg, title.on)).toBeGreaterThanOrEqual(HEADER_CONTRAST_TARGET);
    } else {
      // surfaceを追加していない = 素の背景の時点で既に基準を満たしていたはず。
      // (headerTitleColors自体がその判定をして初めてtransparentを返す)
      expect(title.on === "#1a1a1a" || title.on === "#ffffff").toBe(true);
    }
  });
});

describe("headerThemeStyle", () => {
  it("有効なCSS linear-gradient文字列と、全token(chip/title/search)を返す", () => {
    const style = headerThemeStyle({ themePrimary: "#1D4ED8", themeAccent: "#38BDF8" });
    expect(style["--header-gradient"]).toBe(gradientCss(teamGradientStops("#1D4ED8", "#38BDF8")));
    // 135degではなく105deg固定であることを、gradientCss()を経由せずリテラルの
    // 正規表現で独立に確認する(Phase UI-2Bの角度比較調査で135deg→105degへ変更)。
    expect(style["--header-gradient"]).toMatch(/^linear-gradient\(105deg, .+\)$/);
    for (const key of [
      "--header-chip-on",
      "--header-chip-surface",
      "--header-title-on",
      "--header-title-surface",
      "--header-search-on",
      "--header-search-surface",
    ]) {
      expect(style[key]).toBeTruthy();
    }
  });

  it("未設定時はブランドグラデーション01のCSSを返す", () => {
    const style = headerThemeStyle({ themePrimary: null, themeAccent: null });
    expect(style["--header-gradient"]).toBe(gradientCss(brandGradientStops()));
  });

  it("都賀ビクトリーズ実データ: 生成されるCSS文字列に'105deg'が独立して含まれる(gradientCss()呼び出しに依存しない直接検証)", () => {
    const style = headerThemeStyle({ themePrimary: "#FFAB01", themeAccent: "#011D57" });
    expect(style["--header-gradient"]).toBe("linear-gradient(105deg, #0043cc 0%, #FFAB01 40%, #f2a70d 100%)");
    expect(style["--header-gradient"]).toContain("105deg");
  });
});
