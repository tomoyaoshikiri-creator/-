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
const ON_COLOR_DARK = "#1a1a1a";
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
 * AppHeaderグラデーション(Phase UI-2B)
 *
 * 「CIRCLE LINESブランドグラデーション01」(チームカラー未設定時)と、
 * それを任意のteamPrimary/teamSecondaryへ展開した「チーム版01」を生成する。
 * 生成ロジック・パラメータはPhase UI-2Bの比較検証(モック)で妥当性を確認した
 * 初期アルゴリズム値であり、CIRCLE LINESの永久的なデザイン定数ではない。
 * 将来調整する場合はGRADIENT_PARAMSの値を変更するだけでよい構造にしている。
 * ========================================================== */

export interface GradientParams {
  /** teamPrimary(主役色)を置くグラデーション上の位置(%)。0=深色側、100=明るいアクセント側。 */
  heroStopPercent: number;
  /**
   * 深色(0%)を作る際に、primary自身のHSL明度へ掛ける倍率(0〜1)。小さいほど暗くなる。
   * 相対輝度ベース(Brand Navy相当まで暗くする)ではなく明度ベースにしているのは、
   * 暖色(オレンジ等)はBrand Navyと同じ相対輝度に到達するには明度を極端に落とす必要が
   * あり、結果が「濃いprimary」ではなく「無関係な暗色(黒・こげ茶)」に見えてしまう
   * ためで、実機検証で確認した。暖色は相対輝度への寄与(R+Gチャンネル)が大きいため、
   * 寒色よりずっと明度を落とさないと同じ相対輝度に届かない。明度の倍率で下げる方式なら、
   * どの色相でも「同じ色の濃い版」として一貫して認識できる。
   */
  deepLightnessScale: number;
}

export const GRADIENT_PARAMS: GradientParams = {
  heroStopPercent: 40,
  deepLightnessScale: 0.55,
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

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.min(100, Math.max(0, s)) / 100;
  const light = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) {
    r = c; g = x; b = 0;
  } else if (hue < 120) {
    r = x; g = c; b = 0;
  } else if (hue < 180) {
    r = 0; g = c; b = x;
  } else if (hue < 240) {
    r = 0; g = x; b = c;
  } else if (hue < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

// 色相・彩度を固定したまま、二分探索で「相対輝度が目標値に一致する明度」を求める。
// Brand NavyとBrand CyanはHSL明度がほぼ同じ(46〜49%)だが相対輝度は約5.5倍異なり、
// 「深い/明るい」という知覚差は明度ではなく相対輝度の方に強く現れるため、
// 単純な明度の加減算ではなく相対輝度そのものを目標値にしている。
function solveLightnessForRelativeLuminance(hue: number, sat: number, targetRelLum: number): number {
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    if (relativeLuminance(hslToHex(hue, sat, mid)) < targetRelLum) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const LIGHT_TARGET_RELATIVE_LUMINANCE = relativeLuminance(BRAND_CYAN);

// hexの色相・彩度を保ったまま、HSL明度をGRADIENT_PARAMS.deepLightnessScale倍して
// 「同じ色の濃い版」を返す(相対輝度を固定目標に合わせる方式ではない。理由は
// GradientParams.deepLightnessScaleのコメント参照)。
function towardDeep(hex: string): string {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, s, l * GRADIENT_PARAMS.deepLightnessScale);
}

// hexの色相・彩度を保ったまま、Brand Cyanと同じ相対輝度(明るさ)まで調整した色を返す。
function towardLight(hex: string): string {
  const { h, s } = hexToHsl(hex);
  const sat = Math.min(100, s * 0.9);
  return hslToHex(h, sat, solveLightnessForRelativeLuminance(h, sat, LIGHT_TARGET_RELATIVE_LUMINANCE));
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

// 深色 → teamPrimary(主役、常に無加工でhero位置) → 明るいアクセントの3ストップグラデーション。
// teamPrimaryの色相・彩度のみから深色/アクセントを導出する「単一色相グラデーション」。
// Brand01(Navy→Blue→Cyan)が同一色系統内の明度変化だけで洗練された印象になるのと同じ構造を、
// 任意のteamPrimaryへ適用する(配色再設計: teamSecondaryを直接混合すると、色相差が大きい
// 組み合わせでRGB直線補間特有の「濁った中間色」が発生するため、混合には使わない)。
export function primaryGradientStops(primary: string): GradientStop[] {
  return [
    { position: 0, color: towardDeep(primary) },
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
  return on === "#1a1a1a" ? "#ffffff" : "#0a0a0e";
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
