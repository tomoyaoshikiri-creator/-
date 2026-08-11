"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { CurrentUserBadge } from "@/components/CurrentUserBadge";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { Fab } from "@/components/ui/Modal";
import { ReactionButtons } from "@/components/ReactionButtons";
import { canWriteNotice } from "@/lib/permissions";
import { loadProfilesMap } from "@/lib/profiles";
import { formatDateLabel } from "@/lib/format";
import type { Notice, NoticeAttachment, NoticeReaction, ReactionType } from "@/lib/database.types";
import { NewNoticeModal } from "./NewNoticeModal";

export default function NoticePage() {
  const router = useRouter();
  const { role, teamId, userId } = useSession();
  const toast = useToast();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [attachmentsByNotice, setAttachmentsByNotice] = useState<Record<string, NoticeAttachment[]>>({});
  const [reactions, setReactions] = useState<NoticeReaction[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: n }, profMap] = await Promise.all([
      supabase.from("notices").select("*").order("created_at", { ascending: false }),
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <PageShell
      header={
        <AppHeader
          title="お知らせ"
          searchPlaceholder="検索"
          searchValue={query}
          onSearchChange={setQuery}
          rightSlot={<CurrentUserBadge />}
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
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : filteredNotices.length === 0 ? (
        <EmptyState>{query ? "該当するお知らせがありません" : "お知らせがありません"}</EmptyState>
      ) : (
        filteredNotices.map((n) => (
          <Card key={n.id} className="cursor-pointer" onClick={() => router.push(`/notice/${n.id}`)}>
            <div className="font-bold text-[14.5px]">
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
              userId={userId}
              onToggle={(type) => toggleReaction(n.id, type)}
            />
          </Card>
        ))
      )}
    </PageShell>
  );
}
