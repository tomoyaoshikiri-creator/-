import type { Role } from "@/lib/database.types";

export type TabKey =
  | "home"
  | "schedule"
  | "notice"
  | "report"
  | "coachNote"
  | "players"
  | "game"
  | "karte"
  | "library"
  | "users"
  | "settings"
  | "team";

// ナビ再設計v3(ボトムナビ5タブ化)で、bottom nav上のラベルのみ「予定」「試合」に変更した
// (中身のページ自体・PAGE_TITLESとしての用途は変えていない。両者を意図的に揃えている)。
export const TAB_LABELS: Record<TabKey, string> = {
  home: "ホーム",
  schedule: "予定",
  notice: "お知らせ",
  report: "チーム日報",
  coachNote: "コーチ日報",
  players: "選手一覧",
  game: "試合",
  karte: "カルテ",
  library: "ライブラリ",
  users: "管理",
  settings: "設定",
  team: "チーム",
};

export const TAB_PATHS: Record<TabKey, string> = {
  home: "/home",
  schedule: "/schedule",
  notice: "/notice",
  report: "/report",
  coachNote: "/coach-note",
  players: "/players",
  game: "/game",
  karte: "/karte",
  library: "/library",
  users: "/users",
  settings: "/settings",
  team: "/team",
};

export const PAGE_TITLES: Record<TabKey, string> = {
  home: "ホーム",
  schedule: "予定",
  notice: "お知らせ",
  report: "チーム日報",
  coachNote: "コーチ日報",
  players: "選手一覧",
  game: "試合",
  karte: "カルテ",
  library: "ライブラリ",
  users: "ユーザー管理",
  settings: "設定",
  team: "チーム",
};

// 仕様メモ 2章「権限構造」に基づくタブ出し分け。単一のソースとしてUI・ルートガード双方から参照する。
// 「設定」タブは全ロールに表示するが、中身(チームのロゴ・配色)は canManageSettings で管理者のみに絞る。
// 自分自身のアカウント編集(表示名・パスワード)は同タブ内で全ロールに表示する。
// 選手メモは「選手一覧」タブから選手を選んで登録・閲覧する形にまとめており、専用タブは持たない。
// 「コーチ日報」は指導者・管理者専用。「チーム日報」(全ロール共有)とはテーブルごと分離している。
// 「ライブラリ」(画像・資料の共有置き場)は全ロールに開放している。
// 「試合記録」タブは一般・運営にも見せるが、その中身(スタメン登録などの記録画面)は指導者・管理者のみが
// 操作できるため、一般・運営がタップした場合は結果閲覧専用の /game/results に直接遷移させる(tabHrefForRole)。
// 「選手一覧」は専用タブを廃止し、「カルテ」タブの中の1カードとして統合した(/karte)。
// そのため「カルテ」タブ自体は全ロールに開放し、中身のカード出し分け(チームカルテ・選手カルテは
// canViewKarte、選手一覧は全ロール)は/karte/page.tsx側で行う。選手一覧画面側は元のまま、
// player_guardiansと突き合わせて自分の子ども以外はグレーアウト・選択不可にする
// (players_select_guardian_view、選手詳細ページの本人確認とセットで運用)。
const ROLE_TABS: Record<Role, TabKey[]> = {
  一般: ["schedule", "notice", "report", "game", "karte", "library", "settings"],
  運営: ["schedule", "notice", "report", "game", "karte", "library", "users", "settings"],
  指導者: ["schedule", "notice", "report", "coachNote", "game", "karte", "library", "settings"],
  管理者: ["schedule", "notice", "report", "coachNote", "game", "karte", "library", "users", "settings"],
};

// ROLE_TABSはページ単体のルートガード(canAccessTab、/report・/coach-note・/users・
// /game/results等のuseEffect内のリダイレクト判定)専用として維持する。ボトムナビ自体の
// 表示タブ構成は、ナビ再設計v3(2026-09)以降ロールに関わらず固定のBOTTOM_NAV_TABSを使う
// (TabBar.tsx / Sidebar.tsx)。「コーチ日報」「選手一覧」「ライブラリ」等はhub(/team)配下の
// リンクとして残り、ボトムナビの直接のタブではなくなった。
export function tabsForRole(role: Role): TabKey[] {
  return ROLE_TABS[role];
}

export function canAccessTab(role: Role, tab: TabKey): boolean {
  return ROLE_TABS[role].includes(tab);
}

// ボトムナビ／サイドバーに常時表示する固定5タブ(全ロール共通)。
// 「試合」タブのリンク先はロールによって出し分けるため引き続きtabHrefForRoleを使う。
export const BOTTOM_NAV_TABS: TabKey[] = ["home", "schedule", "notice", "game", "team"];

// ナビ再設計v3 PR1時点の暫定リンク。/home(PR4a)が未実装の間だけ、実在する既存ページへ
// 暫定的に遷移させる。/teamはPR2で実装済みのため、この暫定リンクからは外した。
// PR4aがマージされたらこの暫定リンク自体を削除すること。
const PROVISIONAL_TAB_HREF: Partial<Record<TabKey, string>> = {
  home: "/schedule",
};

// 「試合記録」タブのリンク先。指導者・管理者はスタメン登録などができる一覧画面(/game)へ、
// 一般・運営は結果を見るだけの/game/resultsへ直接飛ばす。
export function tabHrefForRole(role: Role, tab: TabKey): string {
  if (PROVISIONAL_TAB_HREF[tab]) return PROVISIONAL_TAB_HREF[tab];
  if (tab === "game" && !canRecordGames(role)) return "/game/results";
  return TAB_PATHS[tab];
}

// 試合の記録(スタメン登録・得点入力など)を操作できるロール。/game・/game/[id]のガードに使う。
export function canRecordGames(role: Role): boolean {
  return role === "指導者" || role === "管理者";
}

export function canWriteSchedule(role: Role): boolean {
  return role === "一般" || role === "運営" || role === "指導者" || role === "管理者";
}

export function canWriteNotice(role: Role): boolean {
  return role === "一般" || role === "運営" || role === "指導者" || role === "管理者";
}

// 「指導者のみ」向けのお知らせを投稿できるロール。一般・運営がこの公開範囲で投稿すると、
// notices_selectポリシー上、投稿した本人が自分の投稿を読み返せず登録エラーになってしまうため、
// この選択肢自体を指導者・管理者だけに絞る(NewNoticeModal.tsx参照)。
export function canPostTeacherOnlyNotice(role: Role): boolean {
  return role === "指導者" || role === "管理者";
}

export function canWriteReport(role: Role): boolean {
  return role === "一般" || role === "運営" || role === "指導者" || role === "管理者";
}

// コーチノート(指導者・管理者専用の日誌)の閲覧・投稿ができるロール。
export function canWriteCoachNote(role: Role): boolean {
  return role === "指導者" || role === "管理者";
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

// バスケットボール・ミニバスケットボール以外の競技向けカスタムスタッツ項目の管理ができるロール。
export function canManageStatCategories(role: Role): boolean {
  return role === "指導者" || role === "管理者";
}

// カルテタブ(選手ごとのスタッツ・スポーツテスト横断ビュー)を見られるロール。
export function canViewKarte(role: Role): boolean {
  return role === "指導者" || role === "管理者";
}

export function canManageUsers(role: Role): boolean {
  return role === "管理者";
}

export function canManageSettings(role: Role): boolean {
  return role === "管理者";
}

export function canIssueInvite(role: Role): boolean {
  return role === "運営" || role === "指導者" || role === "管理者";
}
