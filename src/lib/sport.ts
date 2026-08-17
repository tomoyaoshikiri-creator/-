import type { TeamSport } from "@/lib/database.types";

export const SPORTS: TeamSport[] = [
  "バスケットボール",
  "ミニバスケットボール",
  "サッカー・ミニサッカー",
  "野球・軟式野球",
  "バレーボール",
];

// 競技名がそのまま表示名なので恒等マップ(プランのFree/Standard/Proのような言い換えは不要)。
export const SPORT_DISPLAY_LABELS: Record<TeamSport, string> = {
  バスケットボール: "バスケットボール",
  ミニバスケットボール: "ミニバスケットボール",
  "サッカー・ミニサッカー": "サッカー・ミニサッカー",
  "野球・軟式野球": "野球・軟式野球",
  バレーボール: "バレーボール",
};

// クォーター制のタップ加算式StatPad(試合スタッツのリアルタイム入力)を使う競技かどうか。
// バスケットボール・ミニバスケットボールのみtrue。それ以外はチームが自由に定義する
// カスタムスタッツ項目を使う。
export function usesDetailedBasketballStats(sport: TeamSport): boolean {
  return sport === "バスケットボール" || sport === "ミニバスケットボール";
}

// 3ポイントシュートのボタン・集計列を出すかどうか。バスケットボールのみtrue
// (ミニバスケットボールは全シュートが2点というルールのため出さない)。
export function usesThreePointScoring(sport: TeamSport): boolean {
  return sport === "バスケットボール";
}
