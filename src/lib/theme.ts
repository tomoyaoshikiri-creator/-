// CIRCLE LINESブランドカラーと、チームカラー(teams.theme_primary/theme_accent)から
// semantic design tokenを組み立てる共通utility。
//
// 責務: 「チームのDB設定 → CSSカスタムプロパティ」の変換ロジックを1箇所に集約し、
// layout.tsx等の呼び出し側に生成ロジックが増殖しないようにする。
//
// 既存互換: --orange/--navy(FAITH CREATION由来の旧token)への注入は本ファイル導入前と
// 完全に同じ条件(truthy値の場合のみ、値の妥当性チェックなしでそのまま代入)を維持する。
// 新しいteamPrimary/teamSecondary/onTeamPrimary/onTeamSecondaryは、不正・未設定値でも
// 必ずCIRCLE LINESブランドカラーへ安全にfallbackする(既存tokenとは独立した経路)。

export const BRAND_NAVY = "#123BDB";
export const BRAND_BLUE = "#087CF0";
export const BRAND_CYAN = "#08C6E8";

// onTeamPrimary/onTeamSecondaryの候補色。既存の--ink(本文文字色)と対応させ、
// 「常に白」ではなくコントラストの高い側を選ぶ。
const ON_COLOR_DARK = "#14151A";
const ON_COLOR_LIGHT = "#ffffff";

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isValidHexColor(value: string | null | undefined): value is string {
  return typeof value === "string" && HEX_COLOR_RE.test(value.trim());
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const body = hex.trim().slice(1);
  const full = body.length === 3
    ? body.split("").map((c) => c + c).join("")
    : body;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

// WCAG 2.x の相対輝度(relative luminance)。単純なRGB平均ではなく、
// 人間の知覚に近づけるためsRGBガンマ補正後にチャンネルごとの重み(0.2126/0.7152/0.0722)を掛ける。
function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

// WCAG 2.x のコントラスト比((L1+0.05)/(L2+0.05)、L1が明るい側)。
export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

// 背景色に対して、濃色(--ink相当)/白系のうちコントラスト比が高い方を返す。
// 不正な値が渡された場合はBrand Blueを背景とみなして安全にfallbackする。
export function onColorFor(backgroundHex: string | null | undefined): string {
  const bg = isValidHexColor(backgroundHex) ? backgroundHex : BRAND_BLUE;
  const contrastWithDark = contrastRatio(bg, ON_COLOR_DARK);
  const contrastWithLight = contrastRatio(bg, ON_COLOR_LIGHT);
  return contrastWithDark >= contrastWithLight ? ON_COLOR_DARK : ON_COLOR_LIGHT;
}

export interface TeamThemeInput {
  themePrimary?: string | null;
  themeAccent?: string | null;
}

export interface TeamThemeTokens {
  teamPrimary: string;
  teamSecondary: string;
  onTeamPrimary: string;
  onTeamSecondary: string;
}

// teams.theme_primary/theme_accentからsemantic tokenを解決する。
// 未設定・不正値(hex形式でない等)は、それぞれBrand Blue/Brand Cyanへfallbackする。
export function resolveTeamTheme({ themePrimary, themeAccent }: TeamThemeInput): TeamThemeTokens {
  const teamPrimary = isValidHexColor(themePrimary) ? themePrimary : BRAND_BLUE;
  const teamSecondary = isValidHexColor(themeAccent) ? themeAccent : BRAND_CYAN;
  return {
    teamPrimary,
    teamSecondary,
    onTeamPrimary: onColorFor(teamPrimary),
    onTeamSecondary: onColorFor(teamSecondary),
  };
}

// (app)/layout.tsxの.app-shellへ渡すinline style用のCSSカスタムプロパティ一式を組み立てる。
// 新token(--team-primary等)は常に安全な値を持つ。旧token(--orange/--navy)は、
// 導入前と全く同じ条件・同じ値でのみ上書きする(既存画面の見た目を変えないため)。
export function teamThemeStyle(input: TeamThemeInput): Record<string, string> {
  const tokens = resolveTeamTheme(input);
  const style: Record<string, string> = {
    "--team-primary": tokens.teamPrimary,
    "--team-secondary": tokens.teamSecondary,
    "--on-team-primary": tokens.onTeamPrimary,
    "--on-team-secondary": tokens.onTeamSecondary,
  };
  if (input.themePrimary) style["--orange"] = input.themePrimary;
  if (input.themeAccent) style["--navy"] = input.themeAccent;
  return style;
}

/* ============================================================
 * AppHeaderグラデーション(Phase UI-2B → MASTER SPECIFICATION #13)
 *
 * 「CIRCLE LINESブランドグラデーション01」(チームカラー未設定時)と、
 * それを任意のteamPrimary/teamSecondaryへ展開した「チーム版01」を生成する。
 * DENSE/LIGHTの生成はOKLCH(知覚的に均等な色空間)ベースで行う。HSL明度の
 * 単純な倍率(旧実装)は廃止した。HSLは色相・彩度の知覚的均等性が低く、
 * 「明度だけ落とす」操作でも彩度が知覚的に大きく落ちて見える(=黒ずんで見える)
 * ことがある。OKLCHはLightness/Chroma/Hueが知覚的に分離されているため、
 * 「Hueを保ったまま、Chromaを上げてLightnessをわずかに下げる」ことで
 * 「暗くする」のではなく「濃く鮮やかにする」DENSE色を作れる。
 * ========================================================== */

export interface GradientParams {
  /** teamPrimary(主役色)を置くグラデーション上の位置(%)。0=DENSE側、100=LIGHT側。 */
  heroStopPercent: number;
  /** DENSE生成: primaryのOKLCH ChromaへかけるBoost倍率(1.0以上)。Hueは変えない。 */
  denseChromaBoost: number;
  /** DENSE生成: primaryのOKLCH LightnessからのDrop幅(0〜1)。最小限(0〜0.03程度)に留める。 */
  denseLightnessDrop: number;
  /** LIGHT生成: primaryのOKLCH Lightnessへ加える幅(0〜1)。Chromaは変えない。 */
  lightLightnessBoost: number;
  /** LIGHT生成時のLightness上限(0〜1)。白飛び(pastel化・無彩色化)を防ぐための上限。 */
  lightLightnessMax: number;
}

export const GRADIENT_PARAMS: GradientParams = {
  heroStopPercent: 40,
  denseChromaBoost: 1.12,
  denseLightnessDrop: 0.02,
  lightLightnessBoost: 0.11,
  lightLightnessMax: 0.95,
};

export interface GradientStop {
  color: string;
  position: number;
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
  return "#" + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("");
}

function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t);
}

// sRGB(0〜255) <-> リニアRGB(0〜1)。OKLab/OKLCH変換の前段・後段で必要な
// ガンマ補正(IEC 61966-2-1)。
function srgbChannelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function linearChannelToSrgb(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return v * 255;
}

// リニアRGB -> OKLab(Björn Ottosson, 2020)。
function linearRgbToOklab(r: number, g: number, b: number): { L: number; a: number; b: number } {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}

// OKLab -> リニアRGB(linearRgbToOklabの逆変換)。
function oklabToLinearRgb(L: number, a: number, b: number): { r: number; g: number; b: number } {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  };
}

interface Oklch {
  L: number;
  C: number;
  /** 度数(0〜360)。 */
  H: number;
}

function hexToOklch(hex: string): Oklch {
  const { r, g, b } = hexToRgb(hex);
  const { L, a, b: ob } = linearRgbToOklab(srgbChannelToLinear(r), srgbChannelToLinear(g), srgbChannelToLinear(b));
  const C = Math.sqrt(a * a + ob * ob);
  let H = (Math.atan2(ob, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

function oklchInSrgbGamut(L: number, C: number, H: number): boolean {
  const hr = (H * Math.PI) / 180;
  const { r, g, b } = oklabToLinearRgb(L, C * Math.cos(hr), C * Math.sin(hr));
  const margin = 1e-4;
  return r >= -margin && r <= 1 + margin && g >= -margin && g <= 1 + margin && b >= -margin && b <= 1 + margin;
}

// OKLCH -> hex。sRGB色域外になる場合は、Lightness/Hueを保ったままChromaだけを
// 二分探索で縮め(gamut clipping)、色域内に収める(色が破綻したり、意図しない
// 色相へずれたりしないようにするため)。
function oklchToHex(L: number, C: number, H: number): string {
  let chroma = C;
  if (!oklchInSrgbGamut(L, C, H)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (oklchInSrgbGamut(L, mid, H)) lo = mid;
      else hi = mid;
    }
    chroma = lo;
  }
  const hr = (H * Math.PI) / 180;
  const { r, g, b } = oklabToLinearRgb(L, chroma * Math.cos(hr), chroma * Math.sin(hr));
  return rgbToHex(linearChannelToSrgb(r), linearChannelToSrgb(g), linearChannelToSrgb(b));
}

// primaryのHueを保ったまま、OKLCH ChromaをdenseChromaBoost倍・Lightnessを
// denseLightnessDropだけ下げた「DENSE(濃い)」色を返す。「暗くする」のではなく
// 「濃く鮮やかにする」ことが目的(MASTER SPECIFICATION #13)。
function towardDense(hex: string): string {
  const { L, C, H } = hexToOklch(hex);
  return oklchToHex(Math.max(0, L - GRADIENT_PARAMS.denseLightnessDrop), C * GRADIENT_PARAMS.denseChromaBoost, H);
}

// primaryのHueとChromaを保ったまま、OKLCH LightnessをlightLightnessBoostだけ
// 上げた「LIGHT(軽やか)」色を返す。lightLightnessMaxで上限を設け、既に明るい
// primaryが白飛び(無彩色化)しないようにする。
function towardLight(hex: string): string {
  const { L, C, H } = hexToOklch(hex);
  const targetL = Math.min(L + GRADIENT_PARAMS.lightLightnessBoost, GRADIENT_PARAMS.lightLightnessMax);
  return oklchToHex(targetL, C, H);
}

// CIRCLE LINESブランドグラデーション01(チームカラー未設定時に使用する確定仕様)。
// Brand Navy → Brand Blue → Brand Cyan、フラット区間のない自然な3ストップグラデーション。
export function brandGradientStops(): GradientStop[] {
  return [
    { position: 0, color: BRAND_NAVY },
    { position: GRADIENT_PARAMS.heroStopPercent, color: BRAND_BLUE },
    { position: 100, color: BRAND_CYAN },
  ];
}

// DENSE → teamPrimary(主役、常に無加工でHERO位置) → LIGHTの3ストップグラデーション。
// teamPrimaryのHueのみからDENSE/LIGHTを導出する「単一色相グラデーション」。
// Brand01(Navy→Blue→Cyan)が同一色系統内の変化だけで洗練された印象になるのと同じ構造を、
// 任意のteamPrimaryへ適用する(配色再設計: teamSecondaryを直接混合すると、色相差が大きい
// 組み合わせでRGB直線補間特有の「濁った中間色」が発生するため、混合には使わない)。
export function primaryGradientStops(primary: string): GradientStop[] {
  return [
    { position: 0, color: towardDense(primary) },
    { position: GRADIENT_PARAMS.heroStopPercent, color: primary },
    { position: 100, color: towardLight(primary) },
  ];
}

// teams.theme_primary/theme_accentの両方が有効なhexの場合のみteamPrimaryのグラデーションを使い、
// それ以外(未設定・片方のみ設定・不正値)は常にブランドグラデーション01を使う。
export function headerGradientStops(input: TeamThemeInput): GradientStop[] {
  const hasTeamColor = isValidHexColor(input.themePrimary) && isValidHexColor(input.themeAccent);
  return hasTeamColor ? primaryGradientStops(input.themePrimary!) : brandGradientStops();
}

// 135deg(左上→右下の対角線45°)だと、AppHeaderのような横長ボックス(幅が高さの
// 2倍以上)ではgradient line geometryにより、ヘッダー下部でdeep色の可視面積が
// 極端に小さくなる(Phase UI-2Bの角度比較調査で実測: 縮小幅が最大39pt)。105degは
// 「左上→右下」の方向感を保ちつつ、ヘッダー上端〜下端でのdeep色到達率の差が
// 8〜11ptまで安定する角度として採用した(調査時の初期値であり永久的な定数ではない)。
export function gradientCss(stops: GradientStop[], angleDeg = 105): string {
  return `linear-gradient(${angleDeg}deg, ${stops.map((s) => `${s.color} ${s.position}%`).join(", ")})`;
}

// グラデーション上の任意位置(t: 0〜1)の色を線形補間で求める。
function sampleGradientColor(stops: GradientStop[], t: number): string {
  const pct = t * 100;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (pct >= a.position && pct <= b.position) {
      const local = b.position === a.position ? 0 : (pct - a.position) / (b.position - a.position);
      return mixHex(a.color, b.color, local);
    }
  }
  return stops[stops.length - 1].color;
}

// WCAG AA、通常サイズの重要テキストの基準。
export const HEADER_CONTRAST_TARGET = 4.5;

// AppHeader内の各要素グループが、グラデーション上のおおよそどの位置に乗るかの目安(0〜1)。
// Phase UI-2Bの検証で、この位置ならほぼ全てのテストカラーで素の状態でも4.5:1を
// 確保できることを確認済み(タイトル位置のみ後述の適応式surfaceが必要)。
export const HEADER_POSITIONS = {
  /** チーム名・ユーザー名・役職・アクセスBadge */
  chipRow: 0.08,
  /** 画面タイトル・戻るボタン */
  titleRow: 0.3,
  /** 検索欄 */
  searchRow: 0.65,
} as const;

// チップ系要素(真の半透明「入れ物」を表示する)の不透明度。事前に単一の不透明色へ
// 合成するのではなく、実際にCSSのrgba()として適用し、下地のグラデーション/washが
// そのまま薄く透けるようにする(配色再設計: 現状の完全不透明矩形が「独立した強い
// UIパーツ」に見えすぎるという指摘への対応)。
const CHIP_SURFACE_ALPHA = 0.22;
// タイトル用の補助surfaceの不透明度(bareで4.5:1を満たさない場合のみ適用)。
const TITLE_SAFETY_SURFACE_ALPHA = 0.2;

function compositeOverlay(bgHex: string, overlayHex: string, alpha: number): string {
  const bg = hexToRgb(bgHex);
  const overlay = hexToRgb(overlayHex);
  return rgbToHex(
    bg.r * (1 - alpha) + overlay.r * alpha,
    bg.g * (1 - alpha) + overlay.g * alpha,
    bg.b * (1 - alpha) + overlay.b * alpha,
  );
}

// 背景の明暗(on)に応じて、明るいsurfaceまたは暗いsurfaceを選ぶ。
function surfaceOverlayFor(on: string): string {
  return on === ON_COLOR_DARK ? "#ffffff" : "#0a0a0e";
}

function rgbaCss(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface HeaderElementColors {
  on: string;
  surface: string;
}

// surfaceがalphaで半透明合成された後のコントラストが高い方のon色(白/濃色)を選ぶ。
function pickOnBySurface(bg: string, alpha: number): string {
  const darkContrast = contrastRatio(compositeOverlay(bg, surfaceOverlayFor(ON_COLOR_DARK), alpha), ON_COLOR_DARK);
  const lightContrast = contrastRatio(compositeOverlay(bg, surfaceOverlayFor(ON_COLOR_LIGHT), alpha), ON_COLOR_LIGHT);
  return darkContrast >= lightContrast ? ON_COLOR_DARK : ON_COLOR_LIGHT;
}

// チーム名・ユーザー名・役職・アクセスBadge・検索欄用: 常時、真の半透明surfaceを持つ。
export function headerChipColors(stops: GradientStop[], t: number): HeaderElementColors {
  const bg = sampleGradientColor(stops, t);
  const on = pickOnBySurface(bg, CHIP_SURFACE_ALPHA);
  return { on, surface: rgbaCss(surfaceOverlayFor(on), CHIP_SURFACE_ALPHA) };
}

// 画面タイトル・戻るボタン用: 素の状態で4.5:1を満たせばsurfaceなし(透明)、
// 満たさない場合だけ薄い半透明の補助surfaceを追加する適応方式。
export function headerTitleColors(stops: GradientStop[], t: number): HeaderElementColors {
  const bg = sampleGradientColor(stops, t);
  for (const on of [ON_COLOR_DARK, ON_COLOR_LIGHT]) {
    if (contrastRatio(bg, on) >= HEADER_CONTRAST_TARGET) return { on, surface: "transparent" };
  }
  const on = pickOnBySurface(bg, TITLE_SAFETY_SURFACE_ALPHA);
  return { on, surface: rgbaCss(surfaceOverlayFor(on), TITLE_SAFETY_SURFACE_ALPHA) };
}

// AppHeaderへ渡すinline style用のCSSカスタムプロパティ一式。teamThemeStyle()とあわせて
// (app)/layout.tsxの.app-shellへ注入する(グラデーション生成・per-要素のcontrast判定を
// 1箇所に集約し、AppHeader.tsx側にロジックが増殖しないようにするため)。
export function headerThemeStyle(input: TeamThemeInput): Record<string, string> {
  const stops = headerGradientStops(input);
  const chip = headerChipColors(stops, HEADER_POSITIONS.chipRow);
  const title = headerTitleColors(stops, HEADER_POSITIONS.titleRow);
  const search = headerChipColors(stops, HEADER_POSITIONS.searchRow);
  return {
    "--header-gradient": gradientCss(stops),
    "--header-chip-on": chip.on,
    "--header-chip-surface": chip.surface,
    "--header-title-on": title.on,
    "--header-title-surface": title.surface,
    "--header-search-on": search.on,
    "--header-search-surface": search.surface,
  };
}
