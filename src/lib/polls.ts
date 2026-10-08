import type { Role } from "@/lib/database.types";

export const POLL_ROLE_OPTIONS: Role[] = ["一般", "運営", "指導者", "管理者"];

export function canVoteInPoll(role: Role, allowedRoles: string[]): boolean {
  return allowedRoles.includes(role);
}

export function pollStatusLabel(status: "open" | "closed"): string {
  return status === "open" ? "受付中" : "締切済み";
}

// 選んだ選択肢の数が、単一選択/複数選択の設定に対して妥当かどうか(送信前のUI側チェック。
// サーバー側でもcast_poll_vote内で同じ内容を検証する)。
export function isValidOptionSelection(optionIds: string[], multiSelect: boolean): boolean {
  if (optionIds.length === 0) return false;
  if (!multiSelect && optionIds.length > 1) return false;
  return true;
}
