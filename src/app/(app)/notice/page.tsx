"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { Fab } from "@/components/ui/Modal";
import { ReactionButtons } from "@/components/ReactionButtons";
import { MonthPicker } from "@/components/MonthPicker";
import { CollapsibleList } from "@/components/CollapsibleList";
import { hasCachedValue, useCachedState } from "@/lib/pageCache";
import { canWriteNotice } from "@/lib/permissions";
import { loadProfilesMap } from "@/lib/profiles";
import { markTabSeen } from "@/lib/tabBadges";
import { computeUnseenNoticeIds, markItemSeen } from "@/lib/itemBadges";
import { currentYearMonth, formatDateLabel, monthRangeBounds } from "@/lib/format";
import type { Notice, NoticeAttachment, NoticeReaction, ReactionType } from "@/lib/database.types";
import { NewNoticeModal } from "./NewNoticeModal";

export default function NoticePage() {
  const router = useRouter();
  const { role, teamId, userId } = useSession();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [monthValue, setMonthValue] = useState(currentYearMonth());
  const [showAll, setShowAll] = useState(false);
  const cacheKey = useCallback((field: string) => `notice:${monthValue}:${field}`, [monthValue]);
  const [notices, setNotices] = useCachedState<Notice[]>(cacheKey("notices"), []);
  const [attachmentsByNotice, setAttachmentsByNotice] = useCachedState<Record<string, NoticeAttachment[]>>(
    cacheKey("attachments"),
    {},
  );
  const [reactions, setReactions] = useCachedState<NoticeReaction[]>(cacheKey("reactions"), []);
  const [profiles, setProfiles] = useCachedState<Record<string, string>>(cacheKey("profiles"), {});
  const [loading, setLoading] = useState(() => !hasCachedValue(cacheKey("notices")));
  const [unseenIds, setUnseenIds] = useCachedState<Set<string>>("notice:unseenIds", new Set());

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!hasCachedValue(cacheKey("notices"))) setLoading(true);
    const { start, end } = monthRangeBounds(monthValue);
    const [{ data: n }, profMap] = await Promise.all([
      supabase
        .from("notices")
        .select("*")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false }),
      loadProfilesMap(supabase),
    ]);
    setNotices(n ?? []);
    setProfiles(profMap);
    if (n && n.length > 0) {
      const noticeIds = n.map((x) => x.id);
      const [{ data: atts }, { data: r }] = await Promise.all([
        supabase.from("notice_attachments").select("*").in("notice_id", noticeIds),
        supabase.from("notice_reactions").select("*").in("notice_id", noticeIds),
      ]);
      const map: Record<string, NoticeAttachment[]> = {};
      (atts ?? []).forEach((a) => {
        (map[a.notice_id] ??= []).push(a);
      });
      setAttachmentsByNotice(map);
      setReactions(r ?? []);
    } else {
      setAttachmentsByNotice({});
      setReactions([]);
    }
    setLoading(false);
  }, [monthValue, cacheKey, setNotices, setProfiles, setAttachmentsByNotice, setReactions]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setShowAll(false);
  }, [monthValue, query]);

  useEffect(() => {
    markTabSeen(userId, "notice");
  }, [userId]);

  useEffect(() => {
    computeUnseenNoticeIds(userId).then(setUnseenIds);
  }, [userId, setUnseenIds]);

  function openNotice(noticeId: string) {
    markItemSeen(userId, "notice", noticeId);
    setUnseenIds((prev) => {
      if (!prev.has(noticeId)) return prev;
      const next = new Set(prev);
      next.delete(noticeId);
      return next;
    });
    router.push(`/notice/${noticeId}`);
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
        toast(`取り消しに失敗しました: ${error.message}`);
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
        toast(`スタンプに失敗しました: ${error.message}`);
        return;
      }
    }
    loadReactions();
  }

  const filteredNotices = notices.filter((n) => n.title.includes(query.trim()));

  function renderNoticeCard(n: Notice) {
    return (
      <Card key={n.id} className="cursor-pointer" onClick={() => openNotice(n.id)}>
        <div className="font-bold text-[14.5px]">
          {unseenIds.has(n.id) && (
            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md mr-1.5 bg-danger/10 text-danger">
              NEW
            </span>
          )}
          {n.audience !== "全員" && (
            <span className="font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-md mr-1.5 bg-navy/8 text-navy">
              {n.audience}
            </span>
          )}
          {n.title}
        </div>
        <div className="text-xs text-ink-soft mt-0.5">
          {n.sender_id && profiles[n.sender_id] ? `${profiles[n.sender_id]} · ` : ""}
          {formatDateLabel(n.created_at.slice(0, 10))}配信
        </div>
        {attachmentsByNotice[n.id]?.length ? (
          <div className="mt-2 flex gap-1.5 flex-wrap">
            {attachmentsByNotice[n.id].map((a) => (
              <span
                key={a.id}
                className="font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-navy/8 text-navy"
              >
                📎 {a.kind}
              </span>
            ))}
          </div>
        ) : null}
        <ReactionButtons
          reactions={reactions.filter((r) => r.notice_id === n.id)}
          onToggle={(type) => toggleReaction(n.id, type)}
        />
      </Card>
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
                toast("お知らせを登録しました");
              }}
            />
          </>
        )
      }
    >
      <SectionLabel>お知らせ</SectionLabel>
      <MonthPicker value={monthValue} onChange={setMonthValue} />
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : filteredNotices.length === 0 ? (
        <EmptyState>{query ? "該当するお知らせがありません" : "この月のお知らせはありません"}</EmptyState>
      ) : (
        <CollapsibleList items={filteredNotices} showAll={showAll} onShowAll={() => setShowAll(true)} renderItem={renderNoticeCard} />
      )}
    </PageShell>
  );
}
