import type { Role } from "@/lib/database.types";

export type TabKey =
  | "schedule"
  | "notice"
  | "report"
  | "players"
  | "notes"
  | "game"
  | "users"
  | "settings";

export const TAB_LABELS: Record<TabKey, string> = {
  schedule: "予定",
  notice: "お知らせ",
  report: "日報",
  players: "選手",
  notes: "メモ",
  game: "試合",
  users: "管理",
  settings: "設定",
};

export const TAB_PATHS: Record<TabKey, string> = {
  schedule: "/schedule",
  notice: "/notice",
  report: "/report",
  players: "/players",
  notes: "/notes",
  game: "/game",
  users: "/users",
  settings: "/settings",
};

export const PAGE_TITLES: Record<TabKey, string> = {
  schedule: "スケジュール",
  notice: "お知らせ",
  report: "練習日報",
  players: "選手一覧",
  notes: "選手メモ",
  game: "試合記録",
  users: "ユーザー管理",
  settings: "設定",
};

// 仕様メモ 2章「権限構造」に基づくタブ出し分け。単一のソースとしてUI・ルートガード双方から参照する。
// 「設定」タブは全ロールに表示するが、中身(チームのロゴ・配色)は canManageSettings で管理者のみに絞る。
// 自分自身のアカウント編集(表示名・パスワード)は同タブ内で全ロールに表示する。
const ROLE_TABS: Record<Role, TabKey[]> = {
  一般: ["schedule", "notice", "report", "settings"],
  役員: ["schedule", "notice", "report", "settings"],
  指導者: ["schedule", "notice", "report", "players", "notes", "game", "settings"],
  管理者: ["schedule", "notice", "report", "players", "notes", "game", "users", "settings"],
};

export function tabsForRole(role: Role): TabKey[] {
  return ROLE_TABS[role];
}

export function canAccessTab(role: Role, tab: TabKey): boolean {
  return ROLE_TABS[role].includes(tab);
}

export function canWriteSchedule(role: Role): boolean {
  return role === "一般" || role === "役員" || role === "指導者" || role === "管理者";
}

export function canWriteNotice(role: Role): boolean {
  return role === "一般" || role === "役員" || role === "指導者" || role === "管理者";
}

export function canManagePlayers(role: Role): boolean {
  return role === "指導者" || role === "管理者";
}

export function canManageUsers(role: Role): boolean {
  return role === "管理者";
}

export function canManageSettings(role: Role): boolean {
  return role === "管理者";
}

export function canIssueInvite(role: Role): boolean {
  return role === "役員" || role === "指導者" || role === "管理者";
}
