"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { canWriteNotice } from "@/lib/permissions";
import { loadProfilesMap } from "@/lib/profiles";
import { formatDateLabel } from "@/lib/format";
import type { Notice, NoticeAttachment } from "@/lib/database.types";

type AttachmentWithUrl = NoticeAttachment & { url: string | null };

export default function NoticeDetailPage() {
  const params = useParams<{ id: string }>();
  const { role } = useSession();
  const toast = useToast();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [attachments, setAttachments] = useState<AttachmentWithUrl[]>([]);
  const [senderName, setSenderName] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: n }, profiles] = await Promise.all([
      supabase.from("notices").select("*").eq("id", params.id).single(),
      loadProfilesMap(supabase),
    ]);
    if (n) {
      setNotice(n);
      setSenderName(n.sender_id ? (profiles[n.sender_id] ?? "") : "");
      const { data: atts } = await supabase.from("notice_attachments").select("*").eq("notice_id", n.id);
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
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit() {
    if (!notice) return;
    setTitle(notice.title);
    setBody(notice.body ?? "");
    setEditing(true);
  }

  async function handleSave() {
    if (!notice) return;
    if (!title.trim()) {
      toast("タイトルを入力してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("notices")
      .update({ title: title.trim(), body: body.trim() || null })
      .eq("id", notice.id);
    setSaving(false);
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }
    toast("お知らせを更新しました");
    setEditing(false);
    load();
  }

  return (
    <PageShell header={<AppHeader title={notice?.title ?? "お知らせ"} variant="detail" backHref="/notice" />}>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : !notice ? (
        <EmptyState>お知らせが見つかりません</EmptyState>
      ) : editing ? (
        <>
          <SectionLabel>お知らせを編集</SectionLabel>
          <Card>
            <FieldLabel>タイトル</FieldLabel>
            <input className={inputClass()} value={title} onChange={(e) => setTitle(e.target.value)} />
            <div className="mt-3">
              <FieldLabel>本文</FieldLabel>
              <textarea
                rows={4}
                className={inputClass()}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div className="text-xs text-ink-soft mt-2">
              ※添付資料はこの編集画面からは変更できません。
            </div>
            <SubmitButton onClick={handleSave} disabled={saving}>
              {saving ? "保存中…" : "保存する"}
            </SubmitButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="w-full mt-2.5 text-center py-2 rounded-[10px] font-bold text-[12.5px] border border-line bg-white text-ink-soft"
            >
              キャンセル
            </button>
          </Card>
        </>
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

          {canWriteNotice(role) && <SubmitButton onClick={startEdit}>編集する</SubmitButton>}
        </>
      )}
    </PageShell>
  );
}
