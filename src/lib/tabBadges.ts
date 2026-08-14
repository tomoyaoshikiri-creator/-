"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TabKey } from "@/lib/permissions";
import { computeTeamAnalysisUnseen, computeUnseenPlayerAnalysisIds, computeUnseenPlayerNoteIds } from "@/lib/itemBadges";

// タブアイコンの新着通知(赤丸)。
// お知らせ・日報は一覧の中の個別項目を辿る先が無いため、従来通り「タブを最後に開いた日時」
// (tab_last_seen)との比較。選手メモ・分析フィードバックは一覧の行ごとに新着かどうかを
// 判定したいので、item_last_seenベースの判定(itemBadges.ts)の結果を集約してタブの丸にする。
export type BadgeTab = "notice" | "report";

export function useTabBadges(userId: string, teamId: string): Partial<Record<TabKey, boolean>> {
  const [badges, setBadges] = useState<Partial<Record<TabKey, boolean>>>({});

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: seenRows } = await supabase.from("tab_last_seen").select("*").eq("user_id", userId);
    const seenMap: Partial<Record<BadgeTab, string>> = {};
    (seenRows ?? []).forEach((r) => {
      if (r.tab === "notice" || r.tab === "report") seenMap[r.tab] = r.seen_at;
    });
    // 一度もそのタブを開いたことが無い場合は、今より前の投稿を新着扱いにしないよう現在時刻を基準にする。
    const now = new Date().toISOString();
    const noticeSeen = seenMap.notice ?? now;
    const reportSeen = seenMap.report ?? now;

    const [{ count: noticeCount }, { count: reportCount }, unseenPlayerNotes, unseenPlayerAnalysis, teamAnalysisUnseen] =
      await Promise.all([
        supabase
          .from("notices")
          .select("id", { count: "exact", head: true })
          .gt("created_at", noticeSeen)
          .neq("sender_id", userId),
        supabase
          .from("reports")
          .select("id", { count: "exact", head: true })
          .or(`created_at.gt.${reportSeen},updated_at.gt.${reportSeen}`)
          .neq("author_id", userId),
        computeUnseenPlayerNoteIds(userId),
        computeUnseenPlayerAnalysisIds(userId),
        computeTeamAnalysisUnseen(userId, teamId),
      ]);

    setBadges({
      notice: (noticeCount ?? 0) > 0,
      report: (reportCount ?? 0) > 0,
      players: unseenPlayerNotes.size > 0,
      karte: unseenPlayerAnalysis.size > 0 || teamAnalysisUnseen,
    });
  }, [userId, teamId]);

  useEffect(() => {
    load();
  }, [load]);

  return badges;
}

// タブを開いたタイミングで呼び、そのタブの「最後に開いた日時」を今に更新する(notice/reportのみ)。
export async function markTabSeen(userId: string, tab: BadgeTab) {
  const supabase = createClient();
  await supabase.from("tab_last_seen").upsert(
    { user_id: userId, tab, seen_at: new Date().toISOString() },
    { onConflict: "user_id,tab" },
  );
}
