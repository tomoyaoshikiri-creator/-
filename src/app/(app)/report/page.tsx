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
import { FieldLabel, inputClass } from "@/components/ui/SegButton";
import { ReactionButtons } from "@/components/ReactionButtons";
import { MonthPicker } from "@/components/MonthPicker";
import { CollapsibleList } from "@/components/CollapsibleList";
import { hasCachedValue, useCachedState } from "@/lib/pageCache";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { canAccessTab, canWriteReport } from "@/lib/permissions";
import { loadProfilesMap } from "@/lib/profiles";
import { markTabSeen } from "@/lib/tabBadges";
import { computeUnseenDailyReportIds, markItemSeen } from "@/lib/itemBadges";
import { isImageFile } from "@/lib/storagePath";
import { currentYearMonth, formatFullDateLabel, monthRangeBounds } from "@/lib/format";
import type {
  DailyReport,
  DailyReportAttachment,
  DailyReportReaction,
  DailyReportComment,
  DailyReportCommentReaction,
  ReactionType,
} from "@/lib/database.types";

type AttachmentWithUrl = DailyReportAttachment & { url: string | null };
import { DateSelect, DATE_OPTIONS } from "./DateSelect";
import { NewDailyReportModal } from "./NewDailyReportModal";

export default function ReportPage() {
  const router = useRouter();
  const { userId, teamId, role } = useSession();
  const toast = useToast();
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [postingCommentId, setPostingCommentId] = useState<string | null>(null);
  const [deleteCommentConfirmId, setDeleteCommentConfirmId] = useState<string | null>(null);
  const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentBody, setEditCommentBody] = useState("");
  const [savingCommentEdit, setSavingCommentEdit] = useState(false);
  const todayValue = DATE_OPTIONS[DATE_OPTIONS.length - 1].value;
  const [modalOpen, setModalOpen] = useState(false);
  const [monthValue, setMonthValue] = useState(currentYearMonth());
  const [showAll, setShowAll] = useState(false);
  const cacheKey = useCallback((field: string) => `report:${monthValue}:${field}`, [monthValue]);
  const [reports, setReports] = useCachedState<DailyReport[]>(cacheKey("reports"), []);
  const [reactions, setReactions] = useCachedState<DailyReportReaction[]>(cacheKey("reactions"), []);
  const [comments, setComments] = useCachedState<DailyReportComment[]>(cacheKey("comments"), []);
  const [commentReactions, setCommentReactions] = useCachedState<DailyReportCommentReaction[]>(
    cacheKey("commentReactions"),
    [],
  );
  const [profiles, setProfiles] = useCachedState<Record<string, string>>(cacheKey("profiles"), {});
  const [attachmentsByReport, setAttachmentsByReport] = useCachedState<Record<string, AttachmentWithUrl[]>>(
    cacheKey("attachments"),
    {},
  );
  const [loading, setLoading] = useState(() => !hasCachedValue(cacheKey("reports")));
  const [unseenIds, setUnseenIds] = useCachedState<Set<string>>("report:unseenIds", new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDateValue, setEditDateValue] = useState(todayValue);
  const [editBody, setEditBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const editingReport = reports.find((r) => r.id === editingId);
  useUnsavedChangesGuard(
    editingReport !== undefined && (editBody !== editingReport.body || editDateValue !== editingReport.date),
  );

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!hasCachedValue(cacheKey("reports"))) setLoading(true);
    const { start, end } = monthRangeBounds(monthValue);
    const [{ data: r }, profMap] = await Promise.all([
      supabase
        .from("daily_reports")
        .select("*")
        .gte("date", start)
        .lt("date", end)
        .order("created_at", { ascending: false }),
      loadProfilesMap(supabase),
    ]);
    setReports(r ?? []);
    setProfiles(profMap);
    if (r && r.length > 0) {
      const reportIds = r.map((x) => x.id);
      const [{ data: rc }, { data: cm }, { data: atts }] = await Promise.all([
        supabase.from("daily_report_reactions").select("*").in("daily_report_id", reportIds),
        supabase
          .from("daily_report_comments")
          .select("*")
          .in("daily_report_id", reportIds)
          .order("created_at", { ascending: true }),
        supabase.from("daily_report_attachments").select("*").in("daily_report_id", reportIds),
      ]);
      setReactions(rc ?? []);
      setComments(cm ?? []);
      const commentIds = (cm ?? []).map((c) => c.id);
      if (commentIds.length > 0) {
        const { data: crc } = await supabase.from("daily_report_comment_reactions").select("*").in("comment_id", commentIds);
        setCommentReactions(crc ?? []);
      } else {
        setCommentReactions([]);
      }
      const attachmentMap: Record<string, AttachmentWithUrl[]> = {};
      await Promise.all(
        (atts ?? []).map(async (a) => {
          const { data: signed } = await supabase.storage
            .from("daily-report-attachments")
            .createSignedUrl(a.storage_path, 60 * 60);
          (attachmentMap[a.daily_report_id] ??= []).push({ ...a, url: signed?.signedUrl ?? null });
        }),
      );
      setAttachmentsByReport(attachmentMap);
    } else {
      setReactions([]);
      setComments([]);
      setCommentReactions([]);
      setAttachmentsByReport({});
    }
    setLoading(false);
  }, [
    monthValue,
    cacheKey,
    setReports,
    setProfiles,
    setReactions,
    setComments,
    setCommentReactions,
    setAttachmentsByReport,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setShowAll(false);
  }, [monthValue]);

  useEffect(() => {
    markTabSeen(userId, "report");
  }, [userId]);

  useEffect(() => {
    computeUnseenDailyReportIds(userId).then(setUnseenIds);
  }, [userId, setUnseenIds]);

  useEffect(() => {
    if (!canAccessTab(role, "report")) router.replace("/schedule");
  }, [role, router]);

  function openReport(reportId: string) {
    markItemSeen(userId, "daily_report", reportId);
    setUnseenIds((prev) => {
      if (!prev.has(reportId)) return prev;
      const next = new Set(prev);
      next.delete(reportId);
      return next;
    });
    setExpandedId((cur) => (cur === reportId ? null : reportId));
  }

  async function loadReactions() {
    const reportIds = reports.map((r) => r.id);
    if (reportIds.length === 0) return;
    const supabase = createClient();
    const { data } = await supabase.from("daily_report_reactions").select("*").in("daily_report_id", reportIds);
    setReactions(data ?? []);
  }

  async function toggleReaction(reportId: string, type: ReactionType) {
    const supabase = createClient();
    const existing = reactions.find(
      (r) => r.daily_report_id === reportId && r.reaction_type === type && r.profile_id === userId,
    );
    if (existing) {
      const { error } = await supabase.from("daily_report_reactions").delete().eq("id", existing.id);
      if (error) {
        toast(`取り消しに失敗しました: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("daily_report_reactions").insert({
        team_id: teamId,
        daily_report_id: reportId,
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

  async function handleAddComment(reportId: string) {
    const body = (commentDrafts[reportId] ?? "").trim();
    if (!body) return;
    setPostingCommentId(reportId);
    const supabase = createClient();
    const { error } = await supabase.from("daily_report_comments").insert({
      team_id: teamId,
      daily_report_id: reportId,
      profile_id: userId,
      body,
    });
    setPostingCommentId(null);
    if (error) {
      toast(`コメントの投稿に失敗しました: ${error.message}`);
      return;
    }
    setCommentDrafts((m) => ({ ...m, [reportId]: "" }));
    const { data } = await supabase
      .from("daily_report_comments")
      .select("*")
      .in(
        "daily_report_id",
        reports.map((r) => r.id),
      )
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

  function startEdit(r: DailyReport) {
    setEditingId(r.id);
    setEditDateValue(r.date);
    setEditBody(r.body);
  }

  async function handleSaveEdit(id: string) {
    if (!editBody.trim()) {
      toast("内容を入力してください");
      return;
    }
    setSavingEdit(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("daily_reports")
      .update({ date: editDateValue, body: editBody.trim(), updated_at: new Date().toISOString() })
      .eq("id", id);
    setSavingEdit(false);
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }
    toast("チーム日報を更新しました");
    setEditingId(null);
    load();
  }

  async function handleDelete(id: string) {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("daily_reports").delete().eq("id", id);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    setDeleteConfirmId(null);
    setExpandedId(null);
    toast("チーム日報を削除しました");
    load();
  }

  return (
    <PageShell
      header={<AppHeader title="チーム日報" />}
      fab={
        canWriteReport(role) && (
          <>
            <Fab onClick={() => setModalOpen(true)} />
            <NewDailyReportModal
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              onCreated={() => {
                setModalOpen(false);
                load();
                toast("チーム日報を登録しました");
              }}
            />
          </>
        )
      }
    >
      <SectionLabel>チーム日報一覧</SectionLabel>
      <MonthPicker value={monthValue} onChange={setMonthValue} />
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : reports.length === 0 ? (
        <EmptyState>この月のチーム日報はありません</EmptyState>
      ) : (
        <CollapsibleList
          items={reports}
          showAll={showAll}
          onShowAll={() => setShowAll(true)}
          renderItem={(r) =>
          editingId === r.id ? (
            <Card key={r.id}>
              <FieldLabel>日付</FieldLabel>
              <DateSelect value={editDateValue} onChange={setEditDateValue} />
              <div className="mt-3">
                <FieldLabel>内容</FieldLabel>
                <textarea
                  rows={3}
                  className={inputClass()}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                />
              </div>
              <div className="flex gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={() => handleSaveEdit(r.id)}
                  disabled={savingEdit}
                  className="flex-1 text-center py-1.5 rounded-[8px] font-bold text-[11px] border border-orange text-orange bg-orange/8"
                >
                  {savingEdit ? "保存中…" : "保存"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  disabled={savingEdit}
                  className="flex-1 text-center py-1.5 rounded-[8px] font-bold text-[11px] border border-line text-ink-soft bg-white"
                >
                  キャンセル
                </button>
              </div>
            </Card>
          ) : (
            <Card
              key={r.id}
              className={canWriteReport(role) ? "cursor-pointer" : ""}
              onClick={() => canWriteReport(role) && openReport(r.id)}
            >
              <div className="font-bold text-[14.5px]">
                {unseenIds.has(r.id) && (
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md mr-1.5 bg-danger/10 text-danger">
                    NEW
                  </span>
                )}
                {formatFullDateLabel(r.date)}
              </div>
              <div className="text-xs text-ink-soft mt-1 whitespace-pre-wrap">{r.body}</div>
              {(attachmentsByReport[r.id]?.length ?? 0) > 0 && (
                <div className="mt-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                  {attachmentsByReport[r.id].map((a) =>
                    a.url && isImageFile(a.file_name) ? (
                      <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={a.url}
                          alt={a.file_name}
                          className="w-full rounded-[10px] border border-line object-contain"
                        />
                      </a>
                    ) : a.url ? (
                      <a
                        key={a.id}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-orange font-bold text-xs"
                      >
                        📎 {a.file_name}
                      </a>
                    ) : null,
                  )}
                </div>
              )}
              <div className="text-xs text-ink-soft mt-1.5">
                {r.author_id ? (profiles[r.author_id] ?? "") : ""}
              </div>
              <ReactionButtons
                reactions={reactions.filter((rc) => rc.daily_report_id === r.id)}
                onToggle={(type) => toggleReaction(r.id, type)}
                profiles={profiles}
              />

              <div className="mt-2.5 pt-2.5 border-t border-line" onClick={(e) => e.stopPropagation()}>
                {expandedId === r.id && (
                  <div className="flex gap-2 mb-2.5">
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      className="flex-1 text-center py-1.5 rounded-[8px] font-bold text-[11px] border border-line text-ink-soft bg-paper"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      className="flex-1 text-center py-1.5 rounded-[8px] font-bold text-[11px] border bg-white whitespace-nowrap"
                      style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                    >
                      {deleteConfirmId === r.id ? "再タップで削除確定" : "削除"}
                    </button>
                  </div>
                )}

                {comments
                  .filter((c) => c.daily_report_id === r.id)
                  .map((c) =>
                    editingCommentId === c.id ? (
                      <div key={c.id} className="mb-2">
                        <input
                          value={editCommentBody}
                          onChange={(e) => setEditCommentBody(e.target.value)}
                          className="w-full min-w-0 border border-line rounded-[8px] px-2 py-1 text-[12px] bg-white text-ink"
                        />
                        <div className="flex gap-2 mt-1.5">
                          <button
                            type="button"
                            onClick={() => handleSaveCommentEdit(c.id)}
                            disabled={savingCommentEdit}
                            className="flex-1 text-center py-1 rounded-[8px] font-bold text-[10.5px] border border-orange text-orange bg-orange/8"
                          >
                            {savingCommentEdit ? "保存中…" : "保存"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCommentId(null)}
                            disabled={savingCommentEdit}
                            className="flex-1 text-center py-1 rounded-[8px] font-bold text-[10.5px] border border-line text-ink-soft bg-white"
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={c.id}
                        className="mb-2"
                        onClick={() =>
                          c.profile_id === userId && setExpandedCommentId(expandedCommentId === c.id ? null : c.id)
                        }
                      >
                        <div className={`text-[12px] ${c.profile_id === userId ? "cursor-pointer" : ""}`}>
                          <span className="text-ink-soft whitespace-pre-wrap">{c.body}</span>
                          <span className="font-bold ml-1">{profiles[c.profile_id] ?? ""}</span>
                        </div>
                        <ReactionButtons
                          reactions={commentReactions.filter((cr) => cr.comment_id === c.id)}
                          onToggle={(type) => toggleCommentReaction(c.id, type)}
                          profiles={profiles}
                        />
                        {c.profile_id === userId && expandedCommentId === c.id && (
                          <div className="flex gap-2 mt-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => startEditComment(c)}
                              className="flex-1 text-center py-1 rounded-[8px] font-bold text-[10.5px] border border-line text-ink-soft bg-paper"
                            >
                              編集
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(c.id)}
                              className="flex-1 text-center py-1 rounded-[8px] font-bold text-[10.5px] border bg-white whitespace-nowrap"
                              style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                            >
                              {deleteCommentConfirmId === c.id ? "再タップで削除確定" : "削除"}
                            </button>
                          </div>
                        )}
                      </div>
                    ),
                  )}
                <div className="flex gap-1.5 mt-1.5">
                  <input
                    value={commentDrafts[r.id] ?? ""}
                    onChange={(e) => setCommentDrafts((m) => ({ ...m, [r.id]: e.target.value }))}
                    placeholder="コメントを書く"
                    className="flex-1 min-w-0 border border-line rounded-[8px] px-2 py-1 text-[12px] bg-white text-ink"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddComment(r.id)}
                    disabled={postingCommentId === r.id || !(commentDrafts[r.id] ?? "").trim()}
                    className="flex-shrink-0 px-3 py-1.5 rounded-[8px] text-[11.5px] font-bold border border-orange text-orange bg-orange/8 disabled:opacity-40"
                  >
                    送信
                  </button>
                </div>
              </div>
            </Card>
          )
          }
        />
      )}
    </PageShell>
  );
}
