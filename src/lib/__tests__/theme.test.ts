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
  primaryGradientStops,
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

  it("primary/secondaryの片方だけ設定されている場合もブランドグラデーション01にfallbackする(既存挙動を維持)", () => {
    expect(headerGradientStops({ themePrimary: "#1D4ED8", themeAccent: null })).toEqual(brandGradientStops());
    expect(headerGradientStops({ themePrimary: null, themeAccent: "#38BDF8" })).toEqual(brandGradientStops());
  });

  it("不正なhex値の場合もブランドグラデーション01にfallbackする", () => {
    expect(headerGradientStops({ themePrimary: "#1D4ED8", themeAccent: "not-a-color" })).toEqual(brandGradientStops());
  });
});

/* ============================================================
 * 以下はすべて、本番実装の内部関数(hexToHsl/compositeOverlay等)を一切importせず、
 * テストファイル内で独立に再実装した検証ヘルパーを使う。「実装側の関数を期待値生成にも
 * そのまま使ってしまい、実装が間違っていてもPASSする」ことを避けるため。
 * ========================================================== */

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

// HSL明度(0〜100)を独立に計算するテスト専用ヘルパー。
function lightnessOf(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return ((Math.max(r, g, b) + Math.min(r, g, b)) / 2) * 100;
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbTupleToHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
  return "#" + [r, g, b].map((v) => c(v).toString(16).padStart(2, "0")).join("");
}

function testMixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgbTuple(a);
  const [br, bg, bb] = hexToRgbTuple(b);
  return rgbTupleToHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
}

function testCompositeAlpha(bgHex: string, overlayHex: string, alpha: number): string {
  const [br, bgc, bb] = hexToRgbTuple(bgHex);
  const [or, og, ob] = hexToRgbTuple(overlayHex);
  return rgbTupleToHex([br * (1 - alpha) + or * alpha, bgc * (1 - alpha) + og * alpha, bb * (1 - alpha) + ob * alpha]);
}

// 本番が返す"rgba(r, g, b, a)"文字列を独立にパースする。
function parseRgba(value: string): { hex: string; alpha: number } {
  const m = value.match(/rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
  if (!m) throw new Error(`not an rgba() string: ${value}`);
  const [, r, g, b, a] = m;
  return { hex: rgbTupleToHex([Number(r), Number(g), Number(b)]), alpha: Number(a) };
}

// テストファイル内で独立に再現した「stops配列上の任意位置(t: 0〜1)の下地色」。
// 本番のsampleGradientColor()は使わず、公開されているstopsの値だけを使って自前で
// 補間する(chip/title/searchそれぞれ異なる位置を正しく扱えるよう、stops配列とtを
// 明示的に受け取る)。
function sampleStopsAt(stops: { color: string; position: number }[], t: number): string {
  const pct = t * 100;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (pct >= a.position && pct <= b.position) {
      const local = b.position === a.position ? 0 : (pct - a.position) / (b.position - a.position);
      return testMixHex(a.color, b.color, local);
    }
  }
  return stops[stops.length - 1].color;
}

// 都賀ビクトリーズ実データを最優先に、ブランド未設定時の回帰確認は別途行うため
// ここではチームカラー設定済みの代表ケースのみを列挙する。
const TEAM_COLOR_CASES: Array<[string, string, string]> = [
  ["tsuga", "#FFAB01", "#011D57"],
  ["blue", "#1D4ED8", "#38BDF8"],
  ["red", "#DC2626", "#F97316"],
  ["green", "#16A34A", "#FACC15"],
  ["purple", "#7C3AED", "#EC4899"],
  ["closeHue", "#0EA5E9", "#2563EB"],
  ["complementary", "#16A34A", "#DC2626"],
  ["bothLight", "#FDE68A", "#A7F3D0"],
  ["bothDark", "#1E1B4B", "#312E81"],
];

// primaryGradientStops: teamPrimaryの単一色相グラデーション。teamPrimaryは常にhero(40%)。
describe("primaryGradientStops(Primary主体グラデーション)", () => {
  it.each(TEAM_COLOR_CASES)("%s: 深色→primary→明るいアクセントの3ストップになり、primaryが無加工でhero位置に保持される", (_key, p) => {
    const stops = primaryGradientStops(p);
    expect(stops).toHaveLength(3);
    expect(stops.map((st) => st.position)).toEqual([0, GRADIENT_PARAMS.heroStopPercent, 100]);
    expect(stops[1].color).toBe(p);
    stops.forEach((st) => expect(isValidHexColor(st.color)).toBe(true));
  });

  it.each(TEAM_COLOR_CASES)("%s: 深色(0%)はprimaryの色相を保ったまま、明度がGRADIENT_PARAMS.deepLightnessScale倍になる(相対輝度を固定目標に合わせない)", (_key, p) => {
    const stops = primaryGradientStops(p);
    expect(hueDiffDeg(hueOf(stops[0].color), hueOf(p))).toBeLessThan(5);
    const expectedLightness = lightnessOf(p) * GRADIENT_PARAMS.deepLightnessScale;
    expect(Math.abs(lightnessOf(stops[0].color) - expectedLightness)).toBeLessThan(2);
    // primaryより明確に暗いこと(相対輝度が下がっていること)を確認する。
    expect(relativeLuminance(stops[0].color)).toBeLessThan(relativeLuminance(p));
  });

  it.each(TEAM_COLOR_CASES)("%s: 深色(0%)はBrand Navyの相対輝度には固定されない(暖色ではBrand Navy相当まで暗くしない)", (_key, p) => {
    const stops = primaryGradientStops(p);
    // GRADIENT_PARAMS.deepLightnessScaleを変更すると生成結果も追従する(ハードコードではない)ことを確認する。
    const before = stops[0].color;
    const original = GRADIENT_PARAMS.deepLightnessScale;
    GRADIENT_PARAMS.deepLightnessScale = 0.8;
    try {
      const after = primaryGradientStops(p)[0].color;
      expect(after).not.toBe(before);
    } finally {
      GRADIENT_PARAMS.deepLightnessScale = original;
    }
  });

  it.each(TEAM_COLOR_CASES)("%s: 明るいアクセント(100%)はprimaryの色相を保ったままBrand Cyan相当の相対輝度になる", (_key, p) => {
    const stops = primaryGradientStops(p);
    expect(hueDiffDeg(hueOf(stops[2].color), hueOf(p))).toBeLessThan(5);
    expect(Math.abs(relativeLuminance(stops[2].color) - relativeLuminance(BRAND_CYAN))).toBeLessThan(0.05);
  });
});

// headerGradientStops/gradientCss: teamSecondaryはHeader背景の生成に一切使用しない
// (同系色グラデーションのみ)ことを、生成されたCSS文字列を直接パースして検証する。
describe("headerGradientStops/gradientCss(Primary主体のみ、Secondary不使用)", () => {
  it("未設定時はBrand Navy→Blue→Cyanのみ、105deg維持", () => {
    const css = gradientCss(headerGradientStops({ themePrimary: null, themeAccent: null }));
    expect(css).toBe("linear-gradient(105deg, #123BDB 0%, #087CF0 40%, #08C6E8 100%)");
    expect(css).not.toContain("radial-gradient");
  });

  it.each(TEAM_COLOR_CASES)("%s: 生成されたCSS文字列にsecondaryの色は一切含まれない", (_key, p, s) => {
    const css = gradientCss(headerGradientStops({ themePrimary: p, themeAccent: s }));
    expect(css.toLowerCase()).not.toContain(s.toLowerCase());
    expect(css).not.toContain("radial-gradient");
    // primaryのdeep/hero/accent由来の3色だけで構成されているはず。
    const stops = primaryGradientStops(p);
    for (const st of stops) {
      expect(css.toLowerCase()).toContain(st.color.toLowerCase());
    }
  });

  it.each(TEAM_COLOR_CASES)("%s: 105deg固定で、有効な単一レイヤーCSS文字列が生成される", (_key, p, s) => {
    const css = gradientCss(headerGradientStops({ themePrimary: p, themeAccent: s }));
    expect(css).toMatch(/^linear-gradient\(105deg, .+\)$/);
  });

  it("都賀ビクトリーズ実データ: 最終CSS文字列が期待通りになる(secondaryを含まない同系色グラデーション)", () => {
    const css = gradientCss(headerGradientStops({ themePrimary: "#FFAB01", themeAccent: "#011D57" }));
    expect(css).toBe("linear-gradient(105deg, #8d5e00 0%, #FFAB01 40%, #f2a70d 100%)");
    expect(css.toLowerCase()).not.toContain("#011d57");
  });
});

// headerChipColors/headerTitleColors: 真の半透明surface(rgba())について、
// 最終合成後のコントラストが4.5:1以上であることを、テストファイル内で独立に
// 再実装した合成ロジック(testCompositeAlpha)で検証する。
describe("headerChipColors/headerTitleColors(半透明surfaceの最終合成コントラスト)", () => {
  it.each(TEAM_COLOR_CASES)("%s: チーム名/ユーザー名/役職/Badge/検索欄(chip系)は常に4.5:1以上", (_key, p) => {
    const stops = primaryGradientStops(p);
    const elements: Array<[ReturnType<typeof headerChipColors>, number]> = [
      [headerChipColors(stops, HEADER_POSITIONS.chipRow), HEADER_POSITIONS.chipRow],
      [headerChipColors(stops, HEADER_POSITIONS.searchRow), HEADER_POSITIONS.searchRow],
    ];
    for (const [el, t] of elements) {
      const { hex: overlayHex, alpha } = parseRgba(el.surface);
      const baseBg = sampleStopsAt(stops, t);
      const effective = testCompositeAlpha(baseBg, overlayHex, alpha);
      expect(contrastRatio(effective, el.on)).toBeGreaterThanOrEqual(HEADER_CONTRAST_TARGET);
    }
  });

  it.each(TEAM_COLOR_CASES)("%s: 画面タイトル/戻るボタンは、bareまたはsurface適用後のいずれかで4.5:1以上", (_key, p) => {
    const stops = primaryGradientStops(p);
    const title = headerTitleColors(stops, HEADER_POSITIONS.titleRow);
    const baseBg = sampleStopsAt(stops, HEADER_POSITIONS.titleRow);
    if (title.surface === "transparent") {
      expect(contrastRatio(baseBg, title.on)).toBeGreaterThanOrEqual(HEADER_CONTRAST_TARGET);
    } else {
      const { hex: overlayHex, alpha } = parseRgba(title.surface);
      const effective = testCompositeAlpha(baseBg, overlayHex, alpha);
      expect(contrastRatio(effective, title.on)).toBeGreaterThanOrEqual(HEADER_CONTRAST_TARGET);
    }
  });

  it("未設定時(ブランド01)もchip/search/titleが4.5:1以上", () => {
    const stops = brandGradientStops();
    const elements: Array<[ReturnType<typeof headerChipColors>, number]> = [
      [headerChipColors(stops, HEADER_POSITIONS.chipRow), HEADER_POSITIONS.chipRow],
      [headerChipColors(stops, HEADER_POSITIONS.searchRow), HEADER_POSITIONS.searchRow],
    ];
    for (const [el, t] of elements) {
      const { hex: overlayHex, alpha } = parseRgba(el.surface);
      const baseBg = sampleStopsAt(stops, t);
      const effective = testCompositeAlpha(baseBg, overlayHex, alpha);
      expect(contrastRatio(effective, el.on)).toBeGreaterThanOrEqual(HEADER_CONTRAST_TARGET);
    }
    const title = headerTitleColors(stops, HEADER_POSITIONS.titleRow);
    const titleBg = sampleStopsAt(stops, HEADER_POSITIONS.titleRow);
    if (title.surface === "transparent") {
      expect(contrastRatio(titleBg, title.on)).toBeGreaterThanOrEqual(HEADER_CONTRAST_TARGET);
    } else {
      const { hex: overlayHex, alpha } = parseRgba(title.surface);
      expect(contrastRatio(testCompositeAlpha(titleBg, overlayHex, alpha), title.on)).toBeGreaterThanOrEqual(
        HEADER_CONTRAST_TARGET,
      );
    }
  });
});

describe("headerThemeStyle", () => {
  it("有効な単一レイヤーCSS文字列と、全token(chip/title/search)を返す", () => {
    const style = headerThemeStyle({ themePrimary: "#1D4ED8", themeAccent: "#38BDF8" });
    expect(style["--header-gradient"]).toBe(gradientCss(headerGradientStops({ themePrimary: "#1D4ED8", themeAccent: "#38BDF8" })));
    expect(style["--header-gradient"]).toMatch(/^linear-gradient\(105deg, .+\)$/);
    expect(style["--header-gradient"]).not.toContain("radial-gradient");
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

  it("都賀ビクトリーズ実データ: --header-gradientがsecondaryを含まない同系色グラデーションになる", () => {
    const style = headerThemeStyle({ themePrimary: "#FFAB01", themeAccent: "#011D57" });
    expect(style["--header-gradient"]).toBe("linear-gradient(105deg, #8d5e00 0%, #FFAB01 40%, #f2a70d 100%)");
    expect(style["--header-gradient"].toLowerCase()).not.toContain("#011d57");
  });
});
