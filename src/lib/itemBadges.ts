"use client";

import { createClient } from "@/lib/supabase/client";

// タブ単位のtab_last_seen(tabBadges.ts)とは別に、一覧の中の「どの項目が新着か」を
// 個別に判定するための仕組み。項目の種類ごとに1件、最後に見た日時を記録する。
export type ItemType = "player_notes" | "player_analysis" | "team_analysis" | "notice" | "daily_report" | "coach_note";

export async function markItemSeen(userId: string, itemType: ItemType, itemId: string) {
  const supabase = createClient();
  await supabase.from("item_last_seen").upsert(
    { user_id: userId, item_type: itemType, item_id: itemId, seen_at: new Date().toISOString() },
    { onConflict: "user_id,item_type,item_id" },
  );
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
