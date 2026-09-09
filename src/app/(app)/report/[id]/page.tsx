"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { ReactionButtons } from "@/components/ReactionButtons";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { canAccessTab, canWriteReport } from "@/lib/permissions";
import { dateDaysAgoStr, formatFullDateLabel } from "@/lib/format";
import { FREE_REPORT_WINDOW_DAYS, hasFullReportHistoryAccess } from "@/lib/plan";
import { loadProfilesMap } from "@/lib/profiles";
import { markItemSeen } from "@/lib/itemBadges";
import { isImageFile } from "@/lib/storagePath";
import type {
  DailyReport,
  DailyReportAttachment,
  DailyReportReaction,
  DailyReportComment,
  DailyReportCommentReaction,
  ReactionType,
} from "@/lib/database.types";
import { DateSelect } from "../DateSelect";

type AttachmentWithUrl = DailyReportAttachment & { url: string | null };

export default function DailyReportDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, teamId, role, plan } = useSession();
  const hasFullHistory = hasFullReportHistoryAccess(plan);
  const earliestAllowedDate = hasFullHistory ? null : dateDaysAgoStr(FREE_REPORT_WINDOW_DAYS - 1);
  const toast = useToast();

  const [report, setReport] = useState<DailyReport | null>(null);
  const [attachments, setAttachments] = useState<AttachmentWithUrl[]>([]);
  const [reactions, setReactions] = useState<DailyReportReaction[]>([]);
  const [comments, setComments] = useState<DailyReportComment[]>([]);
  const [commentReactions, setCommentReactions] = useState<DailyReportCommentReaction[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [editDateValue, setEditDateValue] = useState("");
  const [editBody, setEditBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [commentDraft, setCommentDraft] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentBody, setEditCommentBody] = useState("");
  const [savingCommentEdit, setSavingCommentEdit] = useState(false);
  const [deleteCommentConfirmId, setDeleteCommentConfirmId] = useState<string | null>(null);
  const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);

  useUnsavedChangesGuard(
    editing && report !== null && (editBody !== report.body || editDateValue !== report.date),
  );
  useUnsavedChangesGuard(commentDraft.trim() !== "");
  const editingComment = comments.find((c) => c.id === editingCommentId);
  useUnsavedChangesGuard(editingComment !== undefined && editCommentBody !== editingComment.body);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: r }, profMap] = await Promise.all([
      supabase.from("daily_reports").select("*").eq("id", params.id).maybeSingle(),
      loadProfilesMap(supabase),
    ]);
    setProfiles(profMap);
    // お試しプランの閲覧可能期間より前の日報は、直接URLでアクセスされても見せない
    // (一覧の取得クエリ自体で絞っているため、通常はここに来ない)。
    if (r && earliestAllowedDate && r.date < earliestAllowedDate) {
      setReport(null);
      setLoading(false);
      return;
    }
    setReport(r ?? null);
    if (r) {
      markItemSeen(userId, "daily_report", r.id);
      const [{ data: atts }, { data: rc }, { data: cm }] = await Promise.all([
        supabase.from("daily_report_attachments").select("*").eq("daily_report_id", r.id),
        supabase.from("daily_report_reactions").select("*").eq("daily_report_id", r.id),
        supabase.from("daily_report_comments").select("*").eq("daily_report_id", r.id).order("created_at", { ascending: true }),
      ]);
      const withUrls = await Promise.all(
        (atts ?? []).map(async (a) => {
          const { data: signed } = await supabase.storage
            .from("daily-report-attachments")
            .createSignedUrl(a.storage_path, 60 * 60);
          return { ...a, url: signed?.signedUrl ?? null };
        }),
      );
      setAttachments(withUrls);
      setReactions(rc ?? []);
      setComments(cm ?? []);
      const commentIds = (cm ?? []).map((c) => c.id);
      if (commentIds.length > 0) {
        const { data: crc } = await supabase.from("daily_report_comment_reactions").select("*").in("comment_id", commentIds);
        setCommentReactions(crc ?? []);
      } else {
        setCommentReactions([]);
      }
    }
    setLoading(false);
  }, [params.id, userId, earliestAllowedDate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canAccessTab(role, "report")) router.replace("/home");
  }, [role, router]);

  async function loadReactions() {
    if (!report) return;
    const supabase = createClient();
    const { data } = await supabase.from("daily_report_reactions").select("*").eq("daily_report_id", report.id);
    setReactions(data ?? []);
  }

  async function toggleReaction(type: ReactionType) {
    if (!report) return;
    const supabase = createClient();
    const existing = reactions.find((r) => r.reaction_type === type && r.profile_id === userId);
    if (existing) {
      const { error } = await supabase.from("daily_report_reactions").delete().eq("id", existing.id);
      if (error) {
        toast(`取り消しに失敗しました: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("daily_report_reactions").insert({
        team_id: teamId,
        daily_report_id: report.id,
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

  async function loadCommentReactions() {
    const commentIds = comments.map((c) => c.id);
    if (commentIds.length === 0) return;
    const supabase = createClient();
    const { data } = await supabase.from("daily_report_comment_reactions").select("*").in("comment_id", commentIds);
    setCommentReactions(data ?? []);
  }

  async function toggleCommentReaction(commentId: string, type: ReactionType) {
    const supabase = createClient();
    const existing = commentReactions.find(
      (r) => r.comment_id === commentId && r.reaction_type === type && r.profile_id === userId,
    );
    if (existing) {
      const { error } = await supabase.from("daily_report_comment_reactions").delete().eq("id", existing.id);
      if (error) {
        toast(`取り消しに失敗しました: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("daily_report_comment_reactions").insert({
        team_id: teamId,
        comment_id: commentId,
        profile_id: userId,
        reaction_type: type,
      });
      if (error) {
        toast(`スタンプに失敗しました: ${error.message}`);
        return;
      }
    }
    loadCommentReactions();
  }

  async function handleAddComment() {
    if (!report || !commentDraft.trim()) return;
    setPostingComment(true);
    const supabase = createClient();
    const { error } = await supabase.from("daily_report_comments").insert({
      team_id: teamId,
      daily_report_id: report.id,
      profile_id: userId,
      body: commentDraft.trim(),
    });
    setPostingComment(false);
    if (error) {
      toast(`コメントの投稿に失敗しました: ${error.message}`);
      return;
    }
    setCommentDraft("");
    const { data } = await supabase
      .from("daily_report_comments")
      .select("*")
      .eq("daily_report_id", report.id)
      .order("created_at", { ascending: true });
    setComments(data ?? []);
  }

  async function handleDeleteComment(id: string) {
    if (deleteCommentConfirmId !== id) {
      setDeleteCommentConfirmId(id);
      setTimeout(() => setDeleteCommentConfirmId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    setDeleteCommentConfirmId(null);
    const supabase = createClient();
    const { error } = await supabase.from("daily_report_comments").delete().eq("id", id);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== id));
    setExpandedCommentId(null);
  }

  function startEditComment(c: DailyReportComment) {
    setEditingCommentId(c.id);
    setEditCommentBody(c.body);
    setExpandedCommentId(null);
  }

  async function handleSaveCommentEdit(id: string) {
    if (!editCommentBody.trim()) return;
    setSavingCommentEdit(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("daily_report_comments")
      .update({ body: editCommentBody.trim(), updated_at: new Date().toISOString() })
      .eq("id", id);
    setSavingCommentEdit(false);
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, body: editCommentBody.trim() } : c)));
    setEditingCommentId(null);
  }

  function startEdit() {
    if (!report) return;
    setEditDateValue(report.date);
    setEditBody(report.body);
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (!report) return;
    if (!editBody.trim()) {
      toast("内容を入力してください");
      return;
    }
    setSavingEdit(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("daily_reports")
      .update({ date: editDateValue, body: editBody.trim(), updated_at: new Date().toISOString() })
      .eq("id", report.id);
    setSavingEdit(false);
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }
    toast("チーム日報を更新しました");
    setEditing(false);
    load();
  }

  async function handleDelete() {
    if (!report) return;
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    setDeleting(true);
    const supabase = createClient();
    if (attachments.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("daily-report-attachments")
        .remove(attachments.map((a) => a.storage_path));
      if (storageError) {
        setDeleting(false);
        toast(`削除に失敗しました: ${storageError.message}`);
        return;
      }
    }
    const { error } = await supabase.from("daily_reports").delete().eq("id", report.id);
    setDeleting(false);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    toast("チーム日報を削除しました");
    router.push("/report");
  }

  return (
    <PageShell
      header={
        <AppHeader
          title={report ? formatFullDateLabel(report.date) : "チーム日報"}
          variant="detail"
          backHref="/report"
        />
      }
    >
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : !report ? (
        <EmptyState>チーム日報が見つかりません</EmptyState>
      ) : editing ? (
        <>
          <SectionLabel>チーム日報を編集</SectionLabel>
          <Card>
            <FieldLabel>日付</FieldLabel>
            <DateSelect value={editDateValue} onChange={setEditDateValue} />
            <div className="mt-3">
              <FieldLabel>内容</FieldLabel>
              <textarea rows={4} className={inputClass()} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
            </div>
            <SubmitButton onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? "保存中…" : "保存する"}
            </SubmitButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={savingEdit}
              className="w-full mt-2.5 text-center py-2 rounded-lg font-bold text-[12.5px] border border-line bg-white text-ink-soft"
            >
              キャンセル
            </button>
          </Card>

          <div className="font-mono text-[11px] tracking-widest uppercase text-ink-soft mt-4 mb-2.5">削除</div>
          <Card>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="w-full text-center py-2 rounded-lg font-bold text-[12.5px] border bg-white"
              style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            >
              {deleting ? "削除中…" : deleteConfirm ? "もう一度タップで削除確定" : "このチーム日報を削除する"}
            </button>
          </Card>
        </>
      ) : (
        <>
          <SectionLabel
            action={
              canWriteReport(role) && (
                <button
                  type="button"
                  onClick={startEdit}
                  className="flex-none text-[11px] font-bold text-orange border border-orange rounded-full px-2.5 py-1 bg-orange/8"
                >
                  編集する
                </button>
              )
            }
          >
            内容
          </SectionLabel>
          <Card>
            <div className="text-[14.5px] leading-relaxed whitespace-pre-wrap">{report.body}</div>
            {attachments.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {attachments.map((a) =>
                  a.url && isImageFile(a.file_name) ? (
                    <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.url} alt={a.file_name} className="w-full rounded-lg border border-line object-contain" />
                    </a>
                  ) : a.url ? (
                    <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block text-orange font-bold text-xs">
                      📎 {a.file_name}
                    </a>
                  ) : null,
                )}
              </div>
            )}
            <div className="text-xs text-ink-soft mt-2.5">{report.author_id ? (profiles[report.author_id] ?? "") : ""}</div>
            <ReactionButtons reactions={reactions} onToggle={toggleReaction} profiles={profiles} />
          </Card>

          <SectionLabel>コメント</SectionLabel>
          <Card>
            {comments.length === 0 ? (
              <div className="text-xs text-ink-soft">まだコメントがありません</div>
            ) : (
              comments.map((c) =>
                editingCommentId === c.id ? (
                  <div key={c.id} className="mb-3 last:mb-0">
                    <input
                      value={editCommentBody}
                      onChange={(e) => setEditCommentBody(e.target.value)}
                      className="w-full min-w-0 border border-line rounded-lg px-2 py-1 text-[12px] bg-white text-ink"
                    />
                    <div className="flex gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => handleSaveCommentEdit(c.id)}
                        disabled={savingCommentEdit}
                        className="flex-1 text-center py-1 rounded-lg font-bold text-[10.5px] border border-orange text-orange bg-orange/8"
                      >
                        {savingCommentEdit ? "保存中…" : "保存"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCommentId(null)}
                        disabled={savingCommentEdit}
                        className="flex-1 text-center py-1 rounded-lg font-bold text-[10.5px] border border-line text-ink-soft bg-white"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={c.id} className="mb-3 last:mb-0">
                    <div
                      className={`text-[12.5px] ${c.profile_id === userId ? "cursor-pointer" : ""}`}
                      onClick={() => c.profile_id === userId && setExpandedCommentId(expandedCommentId === c.id ? null : c.id)}
                    >
                      <span className="text-ink-soft whitespace-pre-wrap">{c.body}</span>
                      <span className="font-bold ml-1">{profiles[c.profile_id] ?? ""}</span>
                    </div>
                    <ReactionButtons
                      reactions={commentReactions.filter((cr) => cr.comment_id === c.id)}
                      onToggle={(type) => toggleCommentReaction(c.id, type)}
                      profiles={profiles}
                    />
                    {c.profile_id === userId && expandedCommentId === c.id && (
                      <div className="flex gap-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() => startEditComment(c)}
                          className="flex-1 text-center py-1 rounded-lg font-bold text-[10.5px] border border-line text-ink-soft bg-paper"
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(c.id)}
                          className="flex-1 text-center py-1 rounded-lg font-bold text-[10.5px] border bg-white whitespace-nowrap"
                          style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                        >
                          {deleteCommentConfirmId === c.id ? "再タップで削除確定" : "削除"}
                        </button>
                      </div>
                    )}
                  </div>
                ),
              )
            )}
            <div className="flex gap-1.5 mt-2.5">
              <input
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="コメントを書く"
                className="flex-1 min-w-0 border border-line rounded-lg px-2 py-1 text-[12px] bg-white text-ink"
              />
              <button
                type="button"
                onClick={handleAddComment}
                disabled={postingComment || !commentDraft.trim()}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[11.5px] font-bold border border-orange text-orange bg-orange/8 disabled:opacity-40"
              >
                送信
              </button>
            </div>
          </Card>
        </>
      )}
    </PageShell>
  );
}
