import type { TeamPlan } from "@/lib/database.types";

// プランの序列(上位プランは下位プランの機能を全て含む)。Maxは商用プランではないため
// 序列の最上位に置きつつも、スポーツテストの判定だけは`plan === "Max"`の完全一致で行う
// (他チームには機能自体を見せない「存在しないプラン」として扱うため)。
const PLAN_TIER: Record<TeamPlan, number> = { お試し: 0, 中間: 1, フル: 2, Max: 3 };

export const FREE_PLAYER_LIMIT = 15;

export function playerLimitForPlan(plan: TeamPlan): number | null {
  return plan === "お試し" ? FREE_PLAYER_LIMIT : null;
}

// コーチ日報タブ・練習メニュー(予定詳細に埋め込み)は中間プラン以上で利用可能。
export function hasCoachNoteAccess(plan: TeamPlan): boolean {
  return PLAN_TIER[plan] >= PLAN_TIER["中間"];
}

export function hasPracticeMenuAccess(plan: TeamPlan): boolean {
  return PLAN_TIER[plan] >= PLAN_TIER["中間"];
}

// CLUB KARTEの「チームカルテ」「選手カルテ」(試合スタッツ・カルテ閲覧・AI分析・
// 保護者向けチーム平均公開)はフルプラン以上で利用可能。「選手一覧」自体は含まない
// (基本機能として全プランで利用可能)。
export function hasKarteTabAccess(plan: TeamPlan): boolean {
  return PLAN_TIER[plan] >= PLAN_TIER["フル"];
}

// スポーツテストは商用プランには存在せず、都賀ビクトリーズ専用のMaxプランでのみ有効。
// 他チームには機能の存在自体を見せないため、ロック表示ではなく非表示にする。
export function hasSportsTestAccess(plan: TeamPlan): boolean {
  return plan === "Max";
}
