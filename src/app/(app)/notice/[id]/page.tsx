"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SegButton, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { ReactionButtons } from "@/components/ReactionButtons";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { canPostTeacherOnlyNotice, canWriteNotice } from "@/lib/permissions";
import { loadProfilesMap } from "@/lib/profiles";
import { formatDateLabel, gradeLabel } from "@/lib/format";
import { GRADES_BY_CATEGORY } from "@/lib/playerOptions";
import { attachmentKindSlug, isImageFile, safeExt } from "@/lib/storagePath";
import { cleanupUploadedObjects } from "@/lib/storageCleanup";
import { resizeImageFile } from "@/lib/resizeImage";
import type {
  AttachmentKind,
  Notice,
  NoticeAttachment,
  NoticeAudience,
  NoticeReaction,
  ReactionType,
} from "@/lib/database.types";

type AttachmentWithUrl = NoticeAttachment & { url: string | null };

const KINDS: { kind: AttachmentKind; emoji: string }[] = [
  { kind: "対戦表", emoji: "📋" },
  { kind: "配車表", emoji: "🚗" },
  { kind: "その他", emoji: "📎" },
];

const AUDIENCES: NoticeAudience[] = ["全員", "指導者のみ", "運営以上", "学年指定"];

export default function NoticeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { teamId, role, userId, category } = useSession();
  const toast = useToast();
  const audiences = (canPostTeacherOnlyNotice(role) ? AUDIENCES : AUDIENCES.filter((a) => a !== "指導者のみ")).filter(
    (a) => a !== "学年指定" || category !== "その他",
  );
  const gradeOptions = GRADES_BY_CATEGORY[category].filter((g) => g.value !== "0");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [attachments, setAttachments] = useState<AttachmentWithUrl[]>([]);
  const [reactions, setReactions] = useState<NoticeReaction[]>([]);
  const [senderName, setSenderName] = useState("");
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<NoticeAudience>("全員");
  const [targetGradeMin, setTargetGradeMin] = useState("");
  const [newFiles, setNewFiles] = useState<Partial<Record<AttachmentKind, File>>>({});
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useUnsavedChangesGuard(
    editing &&
      notice !== null &&
      (title !== notice.title ||
        body !== (notice.body ?? "") ||
        audience !== notice.audience ||
        targetGradeMin !== (notice.target_grade_min ?? "") ||
        Object.keys(newFiles).length > 0),
  );

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: n }, profMap] = await Promise.all([
      supabase.from("notices").select("*").eq("id", params.id).single(),
      loadProfilesMap(supabase),
    ]);
    setProfiles(profMap);
    if (n) {
      setNotice(n);
      setSenderName(n.sender_id ? (profMap[n.sender_id] ?? "") : "");
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
      const { data: r } = await supabase.from("notice_reactions").select("*").eq("notice_id", n.id);
      setReactions(r ?? []);
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadReactions() {
    if (!notice) return;
    const supabase = createClient();
    const { data } = await supabase.from("notice_reactions").select("*").eq("notice_id", notice.id);
    setReactions(data ?? []);
  }

  async function toggleReaction(type: ReactionType) {
    if (!notice) return;
    const supabase = createClient();
    const existing = reactions.find((r) => r.reaction_type === type && r.profile_id === userId);
    if (existing) {
      const { error } = await supabase.from("notice_reactions").delete().eq("id", existing.id);
      if (error) {
        toast(`取り消しに失敗しました: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("notice_reactions").insert({
        team_id: teamId,
        notice_id: notice.id,
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

  function startEdit() {
    if (!notice) return;
    setTitle(notice.title);
    setBody(notice.body ?? "");
    setAudience(notice.audience);
    setTargetGradeMin(notice.target_grade_min ?? "");
    setNewFiles({});
    setEditing(true);
  }

  function pickFile(kind: AttachmentKind, file: File | undefined) {
    setNewFiles((prev) => {
      const next = { ...prev };
      if (file) next[kind] = file;
      else delete next[kind];
      return next;
    });
  }

  async function handleRemoveAttachment(attachment: AttachmentWithUrl) {
    setRemovingId(attachment.id);
    const supabase = createClient();
    const { error: storageError } = await supabase.storage
      .from("notice-attachments")
      .remove([attachment.storage_path]);
    if (storageError) {
      setRemovingId(null);
      toast(`削除に失敗しました: ${storageError.message}`);
      return;
    }
    const { error } = await supabase.from("notice_attachments").delete().eq("id", attachment.id);
    setRemovingId(null);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    toast("添付資料を削除しました");
  }

  async function handleSave() {
    if (!notice) return;
    if (!title.trim()) {
      toast("タイトルを入力してください");
      return;
    }
    if (audience === "学年指定" && !targetGradeMin) {
      toast("対象学年を選択してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("notices")
      .update({
        title: title.trim(),
        body: body.trim() || null,
        audience,
        target_grade_min: audience === "学年指定" ? targetGradeMin : null,
      })
      .eq("id", notice.id);
    if (error) {
      setSaving(false);
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }

    // お知らせ本体の更新は上記で既に確定している(ロールバックしない)。
    // 今回追加しようとした添付だけを対象に、1件でも失敗したら今回追加分全体を取り消す
    // (既存のお知らせ本体・既存添付には一切影響を与えない)。
    const entries = Object.entries(newFiles) as [AttachmentKind, File][];
    const uploaded: { kind: AttachmentKind; path: string; file: File; uploadFile: File }[] = [];
    const insertedAttachmentIds: string[] = [];
    let failureMessage: string | null = null;

    for (const [kind, file] of entries) {
      const uploadFile = await resizeImageFile(file);
      const path = `${teamId}/${notice.id}/${attachmentKindSlug(kind)}-${Date.now()}.${safeExt(uploadFile.name)}`;
      const { error: uploadError } = await supabase.storage.from("notice-attachments").upload(path, uploadFile);
      if (uploadError) {
        failureMessage = `${kind}のアップロードに失敗しました: ${uploadError.message}`;
        break;
      }
      uploaded.push({ kind, path, file, uploadFile });
      const { data: attachRow, error: attachError } = await supabase
        .from("notice_attachments")
        .insert({
          notice_id: notice.id,
          kind,
          storage_path: path,
          file_name: file.name,
          size_bytes: uploadFile.size,
        })
        .select()
        .single();
      if (attachError || !attachRow) {
        failureMessage = `${kind}の登録に失敗しました: ${attachError?.message ?? ""}`;
        break;
      }
      insertedAttachmentIds.push(attachRow.id);
    }

    if (failureMessage) {
      let cleanupOk = true;
      if (insertedAttachmentIds.length > 0) {
        const { error: delError } = await supabase.from("notice_attachments").delete().in("id", insertedAttachmentIds);
        if (delError) {
          cleanupOk = false;
          console.error("[notice/edit] failed to rollback newly inserted attachments", delError);
        }
      }
      const objectsOk = await cleanupUploadedObjects(
        supabase,
        uploaded.map((u) => ({ bucket: "notice-attachments", path: u.path })),
      );
      cleanupOk = cleanupOk && objectsOk;
      setSaving(false);
      toast(
        `お知らせ本体は更新しましたが、添付の追加に失敗しました: ${failureMessage}` +
          (cleanupOk ? "" : "(後片付けにも失敗しました。管理者にご確認ください)"),
      );
      load();
      return;
    }

    setSaving(false);
    toast("お知らせを更新しました");
    setEditing(false);
    setNewFiles({});
    load();
  }

  async function handleDeleteNotice() {
    if (!notice) return;
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    setDeleting(true);
    const supabase = createClient();
    if (attachments.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("notice-attachments")
        .remove(attachments.map((a) => a.storage_path));
      if (storageError) {
        setDeleting(false);
        toast(`削除に失敗しました: ${storageError.message}`);
        return;
      }
    }
    const { error } = await supabase.from("notices").delete().eq("id", notice.id);
    setDeleting(false);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    toast("お知らせを削除しました");
    router.push("/notice");
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

            <div className="mt-3">
              <FieldLabel>公開範囲</FieldLabel>
              <div className="flex gap-1.5 flex-wrap">
                {audiences.map((a) => (
                  <SegButton
                    key={a}
                    variant="small"
                    active={audience === a}
                    onClick={() => setAudience(a)}
                    className="flex-none px-3"
                  >
                    {a}
                  </SegButton>
                ))}
              </div>
              {audience === "学年指定" && (
                <select
                  className={inputClass("mt-2")}
                  value={targetGradeMin}
                  onChange={(e) => setTargetGradeMin(e.target.value)}
                >
                  <option value="">対象学年を選択してください</option>
                  {gradeOptions.map((g) => (
                    <option key={g.value} value={g.value}>
                      {gradeLabel(g.value, category)}以上
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="mt-3">
              <FieldLabel>現在の添付資料</FieldLabel>
              {attachments.length === 0 ? (
                <div className="text-xs text-ink-soft">添付資料はありません</div>
              ) : (
                attachments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-line last:border-b-0">
                    <div className="text-xs text-ink-soft">
                      📎 {a.kind}:{a.file_name}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(a)}
                      disabled={removingId === a.id}
                      className="text-[11px] font-bold"
                      style={{ color: "var(--danger)" }}
                    >
                      {removingId === a.id ? "削除中…" : "削除"}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3">
              <FieldLabel>資料を追加</FieldLabel>
              <div className="flex gap-1.5 flex-wrap">
                {KINDS.map(({ kind, emoji }) => (
                  <label
                    key={kind}
                    className={`flex-none px-3 py-2 rounded-[10px] text-[12.5px] font-bold border inline-flex items-center gap-1 cursor-pointer ${
                      newFiles[kind] ? "bg-orange text-white border-orange" : "bg-paper text-ink-soft border-line"
                    }`}
                  >
                    {emoji} {kind}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => pickFile(kind, e.target.files?.[0])}
                    />
                  </label>
                ))}
              </div>
              <div className="mt-1.5">
                {Object.entries(newFiles).map(([kind, file]) => (
                  <div key={kind} className="text-xs text-ink-soft">
                    {kind}: {file.name}
                  </div>
                ))}
              </div>
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

          <div className="font-mono text-[11px] tracking-widest uppercase text-ink-soft mt-4 mb-2.5">削除</div>
          <Card>
            <button
              type="button"
              onClick={handleDeleteNotice}
              disabled={deleting}
              className="w-full text-center py-2 rounded-[10px] font-bold text-[12.5px] border bg-white"
              style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            >
              {deleting ? "削除中…" : deleteConfirm ? "もう一度タップで削除確定" : "このお知らせを削除する"}
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
          {notice.audience !== "全員" && (
            <>
              <SectionLabel>公開範囲</SectionLabel>
              <Card>
                <div className="text-xs text-ink-soft">
                  {notice.audience}
                  {notice.audience === "学年指定" && notice.target_grade_min
                    ? `(${gradeLabel(notice.target_grade_min, category)}以上)`
                    : ""}
                </div>
              </Card>
            </>
          )}
          <SectionLabel>本文</SectionLabel>
          <Card>
            <div className="font-medium text-[14.5px] whitespace-pre-wrap">{notice.body || "(本文なし)"}</div>
          </Card>
          {attachments.length > 0 && (
            <>
              <SectionLabel>添付資料</SectionLabel>
              <Card>
                {attachments.map((a) => (
                  <div key={a.id} className="mb-3 last:mb-0">
                    <div className="text-xs text-ink-soft mb-1.5">
                      {KINDS.find((k) => k.kind === a.kind)?.emoji ?? "📎"} {a.kind}:{a.file_name}
                    </div>
                    {a.url && isImageFile(a.file_name) ? (
                      <a href={a.url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={a.url}
                          alt={a.file_name}
                          className="w-full rounded-[10px] border border-line object-contain"
                        />
                      </a>
                    ) : a.url ? (
                      <a href={a.url} target="_blank" rel="noreferrer" className="text-orange font-bold text-xs">
                        開く
                      </a>
                    ) : null}
                  </div>
                ))}
              </Card>
            </>
          )}

          <ReactionButtons reactions={reactions} onToggle={toggleReaction} profiles={profiles} />

          {canWriteNotice(role) && <SubmitButton onClick={startEdit}>編集する</SubmitButton>}
        </>
      )}
    </PageShell>
  );
}
