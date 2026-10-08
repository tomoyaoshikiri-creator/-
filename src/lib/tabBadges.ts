"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/database.types";
import { canRecordGames, type TabKey } from "@/lib/permissions";
import {
  computeTeamAnalysisUnseen,
  computeUnseenClosedPollIds,
  computeUnseenCoachNoteIds,
  computeUnseenDailyReportIds,
  computeUnseenGameMatchNoteIds,
  computeUnseenNoticeIds,
  computeUnseenPlayerAnalysisIds,
  computeUnseenPlayerNoteIds,
} from "@/lib/itemBadges";

// タブアイコンの新着通知(赤丸)。お知らせ・日報・コーチノート・選手メモ・分析フィードバックは
// すべて一覧の行ごとの新着判定(item_last_seenベース、itemBadges.ts)の結果を集約してタブの丸にする
// (投稿の詳細ページを直接開けば既読になるので、プッシュ通知などタブ一覧を経由しない遷移でも
// バッジが正しく消える)。ライブラリだけはプッシュ通知の遷移先が無く、行ごとの新着判定も
// 無いため、従来通り「タブを最後に開いた日時」(tab_last_seen)との比較のまま。
export type BadgeTab = "notice" | "report" | "coachNote" | "library";

// karte(TabKeyとしてのバッジ)は「チーム」hub配下の3つのカード(選手一覧・選手カルテ・
// チームカルテ)すべての未読を合流させた粗い値で、タブバー自体は廃止済み
// (/karte→/teamへリダイレクト)。「どのカードに新着があるか」を画面側で見分けられるよう、
// 内訳を別途持たせる: playersUnseen=選手メモ(/players)、playerKarteUnseen=選手分析
// (/karte/players)、teamKarteUnseen=チーム分析(/karte/team)。
export interface TabBadges extends Partial<Record<TabKey, boolean>> {
  playersUnseen?: boolean;
  playerKarteUnseen?: boolean;
  teamKarteUnseen?: boolean;
  // 投票:自分が対象ロールでまだ投票していない開催中の投票、または結果発表をまだ見ていない
  // 締切済みの投票のいずれかがあるか。tab_last_seenではなく直接の存在判定のため、
  // BadgeTab(markTabSeen)の仕組みには乗せていない。
  pollUnseen?: boolean;
}

export function useTabBadges(userId: string, teamId: string, role: Role): TabBadges {
  // AppNavはレイアウト側で1回しかマウントされず、タブ間の遷移では再マウントされない。
  // そのため素朴にuseEffect(..., [userId, teamId])だけだと初回にしか判定されず、
  // 既読にした後もタブの赤丸が消えないままになる。pathnameを依存に加え、画面遷移の
  // たびに再判定させることで、タブを開いて既読にした結果を反映させる。
  const pathname = usePathname();
  const [badges, setBadges] = useState<TabBadges>({});

  const load = useCallback(async () => {
    const supabase = createClient();
    // ライブラリのみ、タブを最後に開いた日時(tab_last_seen)との比較。一度も開いたことが
    // 無い場合は、今より前の投稿を新着扱いにしないよう現在時刻を基準にする。
    const { data: librarySeenRow } = await supabase
      .from("tab_last_seen")
      .select("seen_at")
      .eq("user_id", userId)
      .eq("tab", "library")
      .maybeSingle();
    const librarySeen = librarySeenRow?.seen_at ?? new Date().toISOString();

    const [
      { count: libraryCount },
      unseenNotices,
      unseenDailyReports,
      unseenCoachNotes,
      unseenPlayerNotes,
      unseenPlayerAnalysis,
      teamAnalysisUnseen,
      unseenGameMatchNotes,
      unseenClosedPolls,
      { data: openPollRows },
      { data: myVotedPollRows },
    ] = await Promise.all([
      supabase
        .from("library_items")
        .select("id", { count: "exact", head: true })
        .gt("created_at", librarySeen)
        .neq("uploader_id", userId),
      computeUnseenNoticeIds(userId),
      computeUnseenDailyReportIds(userId),
      computeUnseenCoachNoteIds(userId),
      computeUnseenPlayerNoteIds(userId),
      computeUnseenPlayerAnalysisIds(userId),
      computeTeamAnalysisUnseen(userId, teamId),
      // コーチメモは試合記録を操作できるロール(指導者・管理者)のみ閲覧できるため、
      // それ以外のロールでは新着判定自体を行わない。
      canRecordGames(role) ? computeUnseenGameMatchNoteIds(userId) : Promise.resolve(new Set<string>()),
      computeUnseenClosedPollIds(userId),
      supabase.from("polls").select("id, allowed_roles").eq("status", "open"),
      supabase.from("poll_votes").select("poll_id").eq("voter_id", userId),
    ]);

    const noticeUnseen = unseenNotices.size > 0;
    const reportUnseen = unseenDailyReports.size > 0;
    const coachNoteUnseen = unseenCoachNotes.size > 0;
    const libraryUnseen = (libraryCount ?? 0) > 0;
    const playersUnseen = unseenPlayerNotes.size > 0;
    const playerKarteUnseen = unseenPlayerAnalysis.size > 0;
    // 「チーム」タブ・カルテ全体の粗い集約(playersUnseen: 選手メモ、playerKarteUnseen:
    // 選手分析、teamAnalysisUnseen: チーム分析のいずれか)。個別カードにはこの粗い値では
    // なく、それぞれの内訳(playersUnseen/playerKarteUnseen/teamKarteUnseen)を使うこと。
    const karteUnseen = playersUnseen || playerKarteUnseen || teamAnalysisUnseen;
    const gameUnseen = unseenGameMatchNotes.size > 0;
    const myVotedPollIds = new Set((myVotedPollRows ?? []).map((v) => v.poll_id));
    const hasUnvotedOpenPoll = (openPollRows ?? []).some(
      (p) => p.allowed_roles.includes(role) && !myVotedPollIds.has(p.id),
    );
    const pollUnseen = hasUnvotedOpenPoll || unseenClosedPolls.size > 0;

    setBadges({
      notice: noticeUnseen,
      report: reportUnseen,
      coachNote: coachNoteUnseen,
      // 「選手一覧」は専用タブを廃止しカルテタブ内のカードに統合したため、
      // 選手メモの未読もカルテタブの赤丸に合流させる。
      karte: karteUnseen,
      playersUnseen,
      playerKarteUnseen,
      teamKarteUnseen: teamAnalysisUnseen,
      library: libraryUnseen,
      game: gameUnseen,
      pollUnseen,
      // 「チーム」hub配下(チーム日報・コーチ日報・カルテ・ライブラリ・投票)の未読を、
      // ボトムナビの「チーム」タブに件数ではなく単純ドットで集約する。
      team: reportUnseen || coachNoteUnseen || karteUnseen || libraryUnseen || pollUnseen,
    });
  }, [userId, teamId, role]);

  useEffect(() => {
    load();
  }, [load, pathname]);

  return badges;
}

// タブを開いたタイミングで呼び、そのタブの「最後に開いた日時」を今に更新する(notice/report/coachNoteのみ)。
export async function markTabSeen(userId: string, tab: BadgeTab) {
  const supabase = createClient();
  await supabase.from("tab_last_seen").upsert(
    { user_id: userId, tab, seen_at: new Date().toISOString() },
    { onConflict: "user_id,tab" },
  );
}
