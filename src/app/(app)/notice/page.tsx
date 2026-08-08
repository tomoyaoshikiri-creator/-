"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { CurrentUserBadge } from "@/components/CurrentUserBadge";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { Fab } from "@/components/ui/Modal";
import { canWriteNotice } from "@/lib/permissions";
import { loadProfilesMap } from "@/lib/profiles";
import { formatDateLabel } from "@/lib/format";
import type { Notice, NoticeAttachment } from "@/lib/database.types";
import { NewNoticeModal } from "./NewNoticeModal";

export default function NoticePage() {
  const { role } = useSession();
  const toast = useToast();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [attachmentsByNotice, setAttachmentsByNotice] = useState<Record<string, NoticeAttachment[]>>({});
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
      const { data: atts } = await supabase
        .from("notice_attachments")
        .select("*")
        .in("notice_id", n.map((x) => x.id));
      const map: Record<string, NoticeAttachment[]> = {};
      (atts ?? []).forEach((a) => {
        (map[a.notice_id] ??= []).push(a);
      });
      setAttachmentsByNotice(map);
    } else {
      setAttachmentsByNotice({});
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
          <Link key={n.id} href={`/notice/${n.id}`}>
            <Card className="cursor-pointer">
              <div className="font-bold text-[14.5px]">{n.title}</div>
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
            </Card>
          </Link>
        ))
      )}
    </PageShell>
  );
}
