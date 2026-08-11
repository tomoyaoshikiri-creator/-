import type { Role } from "@/lib/database.types";

export type TabKey =
  | "schedule"
  | "notice"
  | "report"
  | "players"
  | "game"
  | "users"
  | "settings";

export const TAB_LABELS: Record<TabKey, string> = {
  schedule: "スケジュール",
  notice: "お知らせ",
  report: "日報",
  players: "選手一覧",
  game: "試合記録",
  users: "管理",
  settings: "設定",
};

export const TAB_PATHS: Record<TabKey, string> = {
  schedule: "/schedule",
  notice: "/notice",
  report: "/report",
  players: "/players",
  game: "/game",
  users: "/users",
  settings: "/settings",
};

export const PAGE_TITLES: Record<TabKey, string> = {
  schedule: "スケジュール",
  notice: "お知らせ",
  report: "練習日報",
  players: "選手一覧",
  game: "試合記録",
  users: "ユーザー管理",
  settings: "設定",
};

// 仕様メモ 2章「権限構造」に基づくタブ出し分け。単一のソースとしてUI・ルートガード双方から参照する。
// 「設定」タブは全ロールに表示するが、中身(チームのロゴ・配色)は canManageSettings で管理者のみに絞る。
// 自分自身のアカウント編集(表示名・パスワード)は同タブ内で全ロールに表示する。
// 選手メモは「選手一覧」タブから選手を選んで登録・閲覧する形にまとめており、専用タブは持たない。
// 「試合記録」タブは一般・役員にも見せるが、その中身(スタメン登録などの記録画面)は指導者・管理者のみが
// 操作できるため、一般・役員がタップした場合は結果閲覧専用の /game/results に直接遷移させる(tabHrefForRole)。
const ROLE_TABS: Record<Role, TabKey[]> = {
  一般: ["schedule", "notice", "report", "game", "settings"],
  役員: ["schedule", "notice", "report", "game", "users", "settings"],
  指導者: ["schedule", "notice", "report", "players", "game", "settings"],
  管理者: ["schedule", "notice", "report", "players", "game", "users", "settings"],
};

export function tabsForRole(role: Role): TabKey[] {
  return ROLE_TABS[role];
}

export function canAccessTab(role: Role, tab: TabKey): boolean {
  return ROLE_TABS[role].includes(tab);
}

// 「試合記録」タブのリンク先。指導者・管理者はスタメン登録などができる一覧画面(/game)へ、
// 一般・役員は結果を見るだけの/game/resultsへ直接飛ばす。
export function tabHrefForRole(role: Role, tab: TabKey): string {
  if (tab === "game" && !canRecordGames(role)) return "/game/results";
  return TAB_PATHS[tab];
}

// 試合の記録(スタメン登録・得点入力など)を操作できるロール。/game・/game/[id]のガードに使う。
export function canRecordGames(role: Role): boolean {
  return role === "指導者" || role === "管理者";
}

export function canWriteSchedule(role: Role): boolean {
  return role === "一般" || role === "役員" || role === "指導者" || role === "管理者";
}

export function canWriteNotice(role: Role): boolean {
  return role === "一般" || role === "役員" || role === "指導者" || role === "管理者";
}

export function canWriteReport(role: Role): boolean {
  return role === "一般" || role === "役員" || role === "指導者" || role === "管理者";
}

export function canManagePlayers(role: Role): boolean {
  return role === "指導者" || role === "管理者";
}

// 練習メニュー(CLUB KARTE)の登録・編集・削除ができるロール。閲覧は全ロールに開放している。
export function canManagePracticeMenus(role: Role): boolean {
  return role === "指導者" || role === "管理者";
}

// スポーツテスト記録(CLUB KARTE、四半期ごと)の閲覧・登録・編集ができるロール。
export function canManageSportsTests(role: Role): boolean {
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
