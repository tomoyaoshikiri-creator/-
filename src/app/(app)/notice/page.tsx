"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { cardClass, EmptyState, SectionLabel } from "@/components/ui/Card";
import { Fab } from "@/components/ui/Modal";
import { ReactionButtons } from "@/components/ReactionButtons";
import { MonthPicker } from "@/components/MonthPicker";
import { CollapsibleList } from "@/components/CollapsibleList";
import { hasCachedValue, useCachedState } from "@/lib/pageCache";
import { canWriteNotice } from "@/lib/permissions";
import { loadProfilesMap } from "@/lib/profiles";
import { computeUnseenNoticeIds } from "@/lib/itemBadges";
import { currentYearMonth, formatDateLabel, todayDateStr } from "@/lib/format";
import { afterNoticeCursor, fetchAllPagesByCursor, sortNoticesByRelatedSchedule } from "@/lib/noticeScheduleLink";
import type { Notice, NoticeAttachment, NoticeReaction, ReactionType, Schedule } from "@/lib/database.types";
import { NewNoticeModal } from "./NewNoticeModal";

// 確定仕様5(3グループのソート)は関連予定の開催日を横断して並べ替える必要があり、
// DB側の単純なORDER BY+カーソルページングでは表現できない。そこで月内のNEWSを
// 「関連予定あり」(related_schedule_id is not null)と「関連予定なし」
// (is null)の2本のクエリに分けて取得する。
//
// 「関連予定あり」は、①本日以降/③過去のどちらに属すかが関連予定の開催日
// (別テーブル)次第で、クライアント側で全件を見てから振り分ける必要があるため、
// 件数の上限で打ち切らず、SCHEDULED_FETCH_BATCH_SIZE件ずつカーソルページングで
// 尽きるまで取得する(1回の問い合わせを小さく保ちつつ、取りこぼしなく全件取得する。
// 取りこぼし・重複のないページング手順そのものはsrc/lib/noticeScheduleLink.tsの
// fetchAllPagesByCursor()に切り出し、単体テストしている)。
// 「関連予定なし」は従来通りNOTICE_PAGE_SIZE単位のカーソルページング
// (hasMore/loadMore、以前の投稿数無制限増加対策 docs/load-handling-todo.md)を
// 維持し、確定仕様5の②グループを形成する。
// 最終的な3グループの並び順はsortNoticesByRelatedSchedule()が担う。
//
// どちらのカーソルも created_at だけでなく id を複合キーとして使う(詳細は
// noticeScheduleLink.tsのafterNoticeCursor()参照)。
const NOTICE_PAGE_SIZE = 30;
const SCHEDULED_FETCH_BATCH_SIZE = 100;

// 「関連予定あり」の全件を、取りこぼしなく尽きるまで取得する。通常は手動で
// 紐づけた少数のNEWSのみのため1回で終わるが、件数が多い月でも
// SCHEDULED_FETCH_BATCH_SIZE件ずつに分けて取得するため、1回の問い合わせが
// 肥大化しない。
async function fetchAllScheduledNotices(supabase: ReturnType<typeof createClient>, monthValue: string): Promise<Notice[]> {
  return fetchAllPagesByCursor<Notice>(async (cursor) => {
    const base = supabase
      .from("notices")
      .select("*")
      .eq("display_year_month", monthValue)
      .not("related_schedule_id", "is", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(SCHEDULED_FETCH_BATCH_SIZE);
    const { data } = cursor ? await base.or(afterNoticeCursor(cursor.createdAt, cursor.id)) : await base;
    return data ?? [];
  }, SCHEDULED_FETCH_BATCH_SIZE);
}

export default function NoticePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role, teamId, userId } = useSession();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const monthParam = searchParams.get("month");
  const [monthValue, setMonthValue] = useState(monthParam ?? currentYearMonth());
  // 開いた直後、URLに?monthが無ければ「今月」ではなく「直近のお知らせが投稿された月」を
  // デフォルトで表示したいため、最新のお知らせを1件取得してその月に合わせる
  // (?monthがあれば、確定仕様10によりそちらを優先しこの処理はスキップする)。
  const [initializing, setInitializing] = useState(monthParam === null);
  const [showAll, setShowAll] = useState(false);
  const cacheKey = useCallback((field: string) => `notice:${monthValue}:${field}`, [monthValue]);
  const [notices, setNotices] = useCachedState<Notice[]>(cacheKey("notices"), []);
  const [attachmentsByNotice, setAttachmentsByNotice] = useCachedState<Record<string, NoticeAttachment[]>>(
    cacheKey("attachments"),
    {},
  );
  const [reactions, setReactions] = useCachedState<NoticeReaction[]>(cacheKey("reactions"), []);
  const [profiles, setProfiles] = useCachedState<Record<string, string>>(cacheKey("profiles"), {});
  const [relatedSchedules, setRelatedSchedules] = useCachedState<Record<string, Schedule>>(
    cacheKey("relatedSchedules"),
    {},
  );
  const [loading, setLoading] = useState(() => !hasCachedValue(cacheKey("notices")));
  const [unseenIds, setUnseenIds] = useCachedState<Set<string>>("notice:unseenIds", new Set());
  const [hasMore, setHasMore] = useCachedState<boolean>(cacheKey("hasMore"), false);
  const [loadingMore, setLoadingMore] = useState(false);

  function changeMonth(v: string) {
    setMonthValue(v);
    // 確定仕様10「同じ画面への往復によって履歴を不要に増やさない」ため、月の切替は
    // pushではなくreplaceでURLに反映する(フォルダ遷移等とは異なり、月送りのたびに
    // 戻るボタンの履歴を1件ずつ積み上げたくない)。
    router.replace(`/notice?month=${v}`, { scroll: false });
  }

  const load = useCallback(async () => {
    if (initializing) return;
    const supabase = createClient();
    if (!hasCachedValue(cacheKey("notices"))) setLoading(true);
    const [scheduled, { data: unscheduledRaw }, profMap] = await Promise.all([
      fetchAllScheduledNotices(supabase, monthValue),
      supabase
        .from("notices")
        .select("*")
        .eq("display_year_month", monthValue)
        .is("related_schedule_id", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .limit(NOTICE_PAGE_SIZE + 1),
      loadProfilesMap(supabase),
    ]);
    const unscheduledPage = (unscheduledRaw ?? []).slice(0, NOTICE_PAGE_SIZE);
    setHasMore((unscheduledRaw?.length ?? 0) > NOTICE_PAGE_SIZE);
    const page = [...scheduled, ...unscheduledPage];
    setNotices(page);
    setProfiles(profMap);
    if (page.length > 0) {
      const noticeIds = page.map((x) => x.id);
      const scheduleIds = [...new Set(page.map((x) => x.related_schedule_id).filter((x): x is string => x !== null))];
      const [{ data: atts }, { data: r }, { data: scheds }] = await Promise.all([
        supabase.from("notice_attachments").select("*").in("notice_id", noticeIds),
        supabase.from("notice_reactions").select("*").in("notice_id", noticeIds),
        scheduleIds.length > 0
          ? supabase.from("schedules").select("*").in("id", scheduleIds)
          : Promise.resolve({ data: [] as Schedule[] }),
      ]);
      const map: Record<string, NoticeAttachment[]> = {};
      (atts ?? []).forEach((a) => {
        (map[a.notice_id] ??= []).push(a);
      });
      setAttachmentsByNotice(map);
      setReactions(r ?? []);
      const schedMap: Record<string, Schedule> = {};
      (scheds ?? []).forEach((s) => {
        schedMap[s.id] = s;
      });
      setRelatedSchedules(schedMap);
    } else {
      setAttachmentsByNotice({});
      setReactions([]);
      setRelatedSchedules({});
    }
    setLoading(false);
  }, [
    initializing,
    monthValue,
    cacheKey,
    setNotices,
    setProfiles,
    setAttachmentsByNotice,
    setReactions,
    setRelatedSchedules,
    setHasMore,
  ]);

  // 「関連予定なし」グループのみを対象にしたカーソルページング(確定仕様とは独立の、
  // 既存機能の維持)。notices状態内の「関連予定なし」サブシーケンスは常に
  // created_at降順(かつ同時刻内はid昇順)を保ったまま末尾に追記されるため、
  // その最後の要素を複合カーソル(created_at, id)に使える。
  async function loadMore() {
    if (loadingMore) return;
    const unscheduledInState = notices.filter((n) => n.related_schedule_id === null);
    if (unscheduledInState.length === 0) return;
    setLoadingMore(true);
    const supabase = createClient();
    const cursor = unscheduledInState[unscheduledInState.length - 1];
    const { data: n } = await supabase
      .from("notices")
      .select("*")
      .eq("display_year_month", monthValue)
      .is("related_schedule_id", null)
      .or(afterNoticeCursor(cursor.created_at, cursor.id))
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(NOTICE_PAGE_SIZE + 1);
    const page = (n ?? []).slice(0, NOTICE_PAGE_SIZE);
    setHasMore((n?.length ?? 0) > NOTICE_PAGE_SIZE);
    if (page.length > 0) {
      setNotices((prev) => [...prev, ...page]);
      const noticeIds = page.map((x) => x.id);
      const [{ data: atts }, { data: r }] = await Promise.all([
        supabase.from("notice_attachments").select("*").in("notice_id", noticeIds),
        supabase.from("notice_reactions").select("*").in("notice_id", noticeIds),
      ]);
      setAttachmentsByNotice((prev) => {
        const merged: Record<string, NoticeAttachment[]> = { ...prev };
        (atts ?? []).forEach((a) => {
          merged[a.notice_id] = [...(merged[a.notice_id] ?? []), a];
        });
        return merged;
      });
      setReactions((prev) => [...prev, ...(r ?? [])]);
    }
    setLoadingMore(false);
  }

  useEffect(() => {
    if (monthParam !== null) {
      setInitializing(false);
      return;
    }
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("notices")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setMonthValue(data.created_at.slice(0, 7));
      setInitializing(false);
    })();
    // マウント時に一度だけ判定する(monthParamは初回値のみ見ればよく、以後のURL変更に
    // 反応して再実行する必要はない)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setShowAll(false);
  }, [monthValue, query]);

  useEffect(() => {
    computeUnseenNoticeIds(userId).then(setUnseenIds);
  }, [userId, setUnseenIds]);

  function openNotice(noticeId: string) {
    // 既読記録(item_last_seen)自体は詳細ページ側のmount時に行う(プッシュ通知からの
    // 直接遷移でも既読になるように)。ここでは一覧上の見た目を即座に更新するだけ。
    setUnseenIds((prev) => {
      if (!prev.has(noticeId)) return prev;
      const next = new Set(prev);
      next.delete(noticeId);
      return next;
    });
    // 確定仕様10: NEWS一覧に戻った際に表示中の月を復元できるよう、詳細画面のURLに
    // 現在の表示対象月を渡しておく(notice/[id]/page.tsxのbackHrefがこれを読む)。
    router.push(`/notice/${noticeId}?month=${monthValue}`);
  }

  async function loadReactions() {
    const noticeIds = notices.map((n) => n.id);
    if (noticeIds.length === 0) return;
    const supabase = createClient();
    const { data } = await supabase.from("notice_reactions").select("*").in("notice_id", noticeIds);
    setReactions(data ?? []);
  }

  async function toggleReaction(noticeId: string, type: ReactionType) {
    const supabase = createClient();
    const existing = reactions.find(
      (r) => r.notice_id === noticeId && r.reaction_type === type && r.profile_id === userId,
    );
    if (existing) {
      const { error } = await supabase.from("notice_reactions").delete().eq("id", existing.id);
      if (error) {
        toast.error(`取り消しに失敗しました: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("notice_reactions").insert({
        team_id: teamId,
        notice_id: noticeId,
        profile_id: userId,
        reaction_type: type,
      });
      if (error) {
        toast.error(`スタンプに失敗しました: ${error.message}`);
        return;
      }
    }
    loadReactions();
  }

  // 確定仕様5: 3グループの並び替え(詳細はsrc/lib/noticeScheduleLink.ts参照)。
  const sortedNotices = sortNoticesByRelatedSchedule(notices, relatedSchedules, todayDateStr());
  const filteredNotices = sortedNotices.filter((n) => n.title.includes(query.trim()));

  function renderNoticeCard(n: Notice) {
    return (
      <div key={n.id} className={`${cardClass} cursor-pointer`} onClick={() => openNotice(n.id)}>
        <div className="font-bold text-sm">
          {unseenIds.has(n.id) && (
            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-lg mr-1.5 bg-danger/10 text-danger-text">
              NEW
            </span>
          )}
          {n.audience !== "全員" && (
            <span className="font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-lg mr-1.5 bg-navy/8 text-navy">
              {n.audience}
            </span>
          )}
          {n.title}
        </div>
        <div className="text-caption text-ink-soft mt-0.5">
          {n.sender_id && profiles[n.sender_id] ? `${profiles[n.sender_id]} · ` : ""}
          {formatDateLabel(n.created_at.slice(0, 10))}配信
        </div>
        {attachmentsByNotice[n.id]?.length ? (
          <div className="mt-2 flex gap-1.5 flex-wrap">
            {attachmentsByNotice[n.id].map((a) => (
              <span
                key={a.id}
                className="font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-lg bg-navy/8 text-navy"
              >
                📎 {a.kind}
              </span>
            ))}
          </div>
        ) : null}
        <ReactionButtons
          reactions={reactions.filter((r) => r.notice_id === n.id)}
          onToggle={(type) => toggleReaction(n.id, type)}
          profiles={profiles}
        />
      </div>
    );
  }

  return (
    <PageShell
      header={
        <AppHeader
          title="お知らせ"
          searchPlaceholder="検索"
          searchValue={query}
          onSearchChange={setQuery}
        />
      }
      fab={
        canWriteNotice(role) && (
          <>
            <Fab onClick={() => setModalOpen(true)} />
            <NewNoticeModal
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              onCreated={() => {
                setModalOpen(false);
                load();
                toast.success("お知らせを登録しました");
              }}
            />
          </>
        )
      }
    >
      <SectionLabel>お知らせ</SectionLabel>
      <MonthPicker value={monthValue} onChange={changeMonth} />
      {initializing || loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : filteredNotices.length === 0 ? (
        <EmptyState>{query ? "該当するお知らせがありません" : "この月のお知らせはありません"}</EmptyState>
      ) : (
        <>
          <CollapsibleList items={filteredNotices} showAll={showAll} onShowAll={() => setShowAll(true)} renderItem={renderNoticeCard} />
          {showAll && hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="flex min-h-tap w-full mt-1 mb-2.5 items-center justify-center rounded-lg font-bold text-caption border border-line text-ink-soft bg-paper"
            >
              {loadingMore ? "読み込み中…" : "さらに読み込む"}
            </button>
          )}
        </>
      )}
    </PageShell>
  );
}
