"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { loadProfilesMap } from "@/lib/profiles";
import { formatDateLabel } from "@/lib/format";
import type { Notice, NoticeAttachment } from "@/lib/database.types";

type AttachmentWithUrl = NoticeAttachment & { url: string | null };

export default function NoticeDetailPage() {
  const params = useParams<{ id: string }>();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [attachments, setAttachments] = useState<AttachmentWithUrl[]>([]);
  const [senderName, setSenderName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: n }, profiles] = await Promise.all([
        supabase.from("notices").select("*").eq("id", params.id).single(),
        loadProfilesMap(supabase),
      ]);
      if (n) {
        setNotice(n);
        setSenderName(n.sender_id ? (profiles[n.sender_id] ?? "") : "");
        const { data: atts } = await supabase
          .from("notice_attachments")
          .select("*")
          .eq("notice_id", n.id);
        const withUrls = await Promise.all(
          (atts ?? []).map(async (a) => {
            const { data: signed } = await supabase.storage
              .from("notice-attachments")
              .createSignedUrl(a.storage_path, 60 * 60);
            return { ...a, url: signed?.signedUrl ?? null };
          }),
        );
        setAttachments(withUrls);
      }
      setLoading(false);
    })();
  }, [params.id]);

  return (
    <PageShell header={<AppHeader title={notice?.title ?? "お知らせ"} variant="detail" backHref="/notice" />}>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : !notice ? (
        <EmptyState>お知らせが見つかりません</EmptyState>
      ) : (
        <>
          <SectionLabel>発信者</SectionLabel>
          <Card>
            <div className="text-xs text-ink-soft">{senderName || "(不明)"}</div>
          </Card>
          <SectionLabel>配信日</SectionLabel>
          <Card>
            <div className="text-xs text-ink-soft">{formatDateLabel(notice.created_at.slice(0, 10))}配信</div>
          </Card>
          <SectionLabel>本文</SectionLabel>
          <Card>
            <div className="font-medium text-[14.5px] whitespace-pre-wrap">{notice.body || "(本文なし)"}</div>
          </Card>
          {attachments.length > 0 && (
            <>
              <SectionLabel>添付資料</SectionLabel>
              <Card>
                {attachments.map((a) => (
                  <div key={a.id} className="text-xs text-ink-soft mb-1 last:mb-0">
                    {a.url ? (
                      <a href={a.url} target="_blank" rel="noreferrer" className="text-orange font-bold">
                        📎 {a.kind}:{a.file_name}
                      </a>
                    ) : (
                      <>
                        📎 {a.kind}:{a.file_name}
                      </>
                    )}
                  </div>
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
