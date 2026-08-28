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
