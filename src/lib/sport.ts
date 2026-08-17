import type { TeamSport } from "@/lib/database.types";

export const SPORTS: TeamSport[] = [
  "バスケットボール",
  "ミニバスケットボール",
  "サッカー",
  "野球",
  "バレーボール",
];

// ミニバスケットボールだけ対象年齢(U12)を添えて表示する。他の競技は複数の区分を1つの
// 選択肢にまとめているわけではないので、年齢区分は付けない。
export const SPORT_DISPLAY_LABELS: Record<TeamSport, string> = {
  バスケットボール: "バスケットボール",
  ミニバスケットボール: "ミニバスケットボール(U12)",
  サッカー: "サッカー",
  野球: "野球",
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
