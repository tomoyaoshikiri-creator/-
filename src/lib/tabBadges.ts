"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TabKey } from "@/lib/permissions";

// タブの新着通知(赤丸)は、個別のメモ・お知らせ単位の既読管理はせず、
// 「そのタブを最後に開いた日時」より新しい他人の投稿・編集があるかどうかだけを見る。
export type BadgeTab = "notice" | "player_notes";

const BADGE_TO_TAB: Record<BadgeTab, TabKey> = {
  notice: "notice",
  player_notes: "players",
};

export function useTabBadges(userId: string): Partial<Record<TabKey, boolean>> {
  const [badges, setBadges] = useState<Partial<Record<TabKey, boolean>>>({});

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: seenRows } = await supabase.from("tab_last_seen").select("*").eq("user_id", userId);
    const seenMap: Partial<Record<BadgeTab, string>> = {};
    (seenRows ?? []).forEach((r) => {
      if (r.tab === "notice" || r.tab === "player_notes") seenMap[r.tab] = r.seen_at;
    });
    // 一度もそのタブを開いたことが無い場合は、今より前の投稿を新着扱いにしないよう現在時刻を基準にする。
    const now = new Date().toISOString();
    const noticeSeen = seenMap.notice ?? now;
    const playerNotesSeen = seenMap.player_notes ?? now;

    const [{ count: noticeCount }, { count: noteCount }] = await Promise.all([
      supabase
        .from("notices")
        .select("id", { count: "exact", head: true })
        .gt("created_at", noticeSeen)
        .neq("sender_id", userId),
      supabase
        .from("player_notes")
        .select("id", { count: "exact", head: true })
        .or(`created_at.gt.${playerNotesSeen},updated_at.gt.${playerNotesSeen}`)
        .neq("author_id", userId),
    ]);

    setBadges({
      [BADGE_TO_TAB.notice]: (noticeCount ?? 0) > 0,
      [BADGE_TO_TAB.player_notes]: (noteCount ?? 0) > 0,
    });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return badges;
}

// タブを開いたタイミングで呼び、そのタブの「最後に開いた日時」を今に更新する。
export async function markTabSeen(userId: string, tab: BadgeTab) {
  const supabase = createClient();
  await supabase.from("tab_last_seen").upsert(
    { user_id: userId, tab, seen_at: new Date().toISOString() },
    { onConflict: "user_id,tab" },
  );
}
