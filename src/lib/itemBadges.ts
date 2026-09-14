"use client";

import { createClient } from "@/lib/supabase/client";

// タブ単位のtab_last_seen(tabBadges.ts)とは別に、一覧の中の「どの項目が新着か」を
// 個別に判定するための仕組み。項目の種類ごとに1件、最後に見た日時を記録する。
export type ItemType =
  | "player_notes"
  | "player_analysis"
  | "team_analysis"
  | "notice"
  | "daily_report"
  | "coach_note"
  | "game_match_note";

export async function markItemSeen(userId: string, itemType: ItemType, itemId: string) {
  const supabase = createClient();
  await supabase.from("item_last_seen").upsert(
    { user_id: userId, item_type: itemType, item_id: itemId, seen_at: new Date().toISOString() },
    { onConflict: "user_id,item_type,item_id" },
  );
}

// markItemSeenと違い、更新前の既読日時(previous)を返してから既読状態を更新する。
// コンテナ(日報・選手・チーム等)を開いた瞬間にitem_last_seenが更新されてしまうため、
// 開いた後に一覧の中の個別項目(コメント・メモ等)へ「NEW」表示を出すには、更新前の
// 既読日時を先に読んでおく必要がある。
export async function markItemSeenAndGetPrevious(
  userId: string,
  itemType: ItemType,
  itemId: string,
): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("item_last_seen")
    .select("seen_at")
    .eq("user_id", userId)
    .eq("item_type", itemType)
    .eq("item_id", itemId)
    .maybeSingle();
  const previous = data?.seen_at ?? null;
  await markItemSeen(userId, itemType, itemId);
  return previous;
}

// candidate(項目の作成日時・更新日時のうち新しい方)が、前回そのコンテナを開いた日時
// (previous)より後かどうかを判定する。previousがnull(そのコンテナを一度も開いたことが
// ない)の場合は、一覧内の全項目が「初めて見る」だけであり「前回から新しく増えた」
// わけではないため、falseを返す(この場合は一覧内の個別NEW表示をせず、コンテナ自体の
// 「NEW」バッジ〈一覧画面のカード側〉だけで新着であることを示す)。
export function isNewSincePrevious(previous: string | null, candidate: string): boolean {
  return previous !== null && candidate > previous;
}

async function loadSeenMap(userId: string, itemType: ItemType): Promise<Map<string, string>> {
  const supabase = createClient();
  const { data } = await supabase
    .from("item_last_seen")
    .select("item_id, seen_at")
    .eq("user_id", userId)
    .eq("item_type", itemType);
  return new Map((data ?? []).map((r) => [r.item_id, r.seen_at]));
}

function isNewer(candidate: string, seenAt: string | undefined): boolean {
  return !seenAt || new Date(candidate) > new Date(seenAt);
}

export async function computeUnseenPlayerNoteIds(userId: string): Promise<Set<string>> {
  const supabase = createClient();
  const [seenMap, { data: notes }] = await Promise.all([
    loadSeenMap(userId, "player_notes"),
    supabase.from("player_notes").select("player_id, author_id, created_at, updated_at"),
  ]);
  const unseen = new Set<string>();
  (notes ?? []).forEach((n) => {
    if (n.author_id === userId) return;
    const latest = n.updated_at > n.created_at ? n.updated_at : n.created_at;
    if (isNewer(latest, seenMap.get(n.player_id))) unseen.add(n.player_id);
  });
  return unseen;
}

export async function computeUnseenPlayerAnalysisIds(userId: string): Promise<Set<string>> {
  const supabase = createClient();
  const [seenMap, { data: notes }] = await Promise.all([
    loadSeenMap(userId, "player_analysis"),
    supabase.from("player_analysis_notes").select("player_id, author_id, created_at, updated_at"),
  ]);
  const unseen = new Set<string>();
  (notes ?? []).forEach((n) => {
    if (n.author_id === userId) return;
    const latest = n.updated_at > n.created_at ? n.updated_at : n.created_at;
    if (isNewer(latest, seenMap.get(n.player_id))) unseen.add(n.player_id);
  });
  return unseen;
}

// コーチメモは選手メモ(player_notes)と同じ構造(1試合=1コンテナに複数のメモ)なので、
// 対象IDはgame_match_id(試合)。
export async function computeUnseenGameMatchNoteIds(userId: string): Promise<Set<string>> {
  const supabase = createClient();
  const [seenMap, { data: notes }] = await Promise.all([
    loadSeenMap(userId, "game_match_note"),
    supabase.from("game_match_notes").select("game_match_id, author_id, created_at, updated_at"),
  ]);
  const unseen = new Set<string>();
  (notes ?? []).forEach((n) => {
    if (n.author_id === userId) return;
    const latest = n.updated_at > n.created_at ? n.updated_at : n.created_at;
    if (isNewer(latest, seenMap.get(n.game_match_id))) unseen.add(n.game_match_id);
  });
  return unseen;
}

export async function computeUnseenNoticeIds(userId: string): Promise<Set<string>> {
  const supabase = createClient();
  const [seenMap, { data: notices }] = await Promise.all([
    loadSeenMap(userId, "notice"),
    supabase.from("notices").select("id, sender_id, created_at"),
  ]);
  const unseen = new Set<string>();
  (notices ?? []).forEach((n) => {
    if (n.sender_id === userId) return;
    if (isNewer(n.created_at, seenMap.get(n.id))) unseen.add(n.id);
  });
  return unseen;
}

export async function computeUnseenDailyReportIds(userId: string): Promise<Set<string>> {
  const supabase = createClient();
  const [seenMap, { data: reports }] = await Promise.all([
    loadSeenMap(userId, "daily_report"),
    supabase.from("daily_reports").select("id, author_id, created_at, updated_at"),
  ]);
  const unseen = new Set<string>();
  (reports ?? []).forEach((r) => {
    if (r.author_id === userId) return;
    const latest = r.updated_at > r.created_at ? r.updated_at : r.created_at;
    if (isNewer(latest, seenMap.get(r.id))) unseen.add(r.id);
  });
  return unseen;
}

export async function computeUnseenCoachNoteIds(userId: string): Promise<Set<string>> {
  const supabase = createClient();
  const [seenMap, { data: reports }] = await Promise.all([
    loadSeenMap(userId, "coach_note"),
    supabase.from("reports").select("id, author_id, created_at, updated_at"),
  ]);
  const unseen = new Set<string>();
  (reports ?? []).forEach((r) => {
    if (r.author_id === userId) return;
    const latest = r.updated_at > r.created_at ? r.updated_at : r.created_at;
    if (isNewer(latest, seenMap.get(r.id))) unseen.add(r.id);
  });
  return unseen;
}

// チーム分析フィードバックは選手ごとではなく1本のストリームなので、対象IDはteamId固定。
export async function computeTeamAnalysisUnseen(userId: string, teamId: string): Promise<boolean> {
  const supabase = createClient();
  const [seenMap, { data: notes }] = await Promise.all([
    loadSeenMap(userId, "team_analysis"),
    supabase.from("team_analysis_notes").select("author_id, created_at, updated_at"),
  ]);
  const seenAt = seenMap.get(teamId);
  return (notes ?? []).some((n) => {
    if (n.author_id === userId) return false;
    const latest = n.updated_at > n.created_at ? n.updated_at : n.created_at;
    return isNewer(latest, seenAt);
  });
}
