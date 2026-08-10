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
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { canAccessTab, canWriteReport } from "@/lib/permissions";
import { loadProfilesMap } from "@/lib/profiles";
import type { Report } from "@/lib/database.types";

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1));

function daysInMonth(month: number): string[] {
  const count = new Date(new Date().getFullYear(), month, 0).getDate();
  return Array.from({ length: count }, (_, i) => String(i + 1));
}

function parseDateLabel(label: string | null): { month: string; day: string } {
  const today = new Date();
  const fallback = { month: String(today.getMonth() + 1), day: String(today.getDate()) };
  const m = label?.match(/^(\d{1,2})\/(\d{1,2})$/);
  return m ? { month: m[1], day: m[2] } : fallback;
}

function MonthDaySelect({
  month,
  day,
  onMonthChange,
  onDayChange,
}: {
  month: string;
  day: string;
  onMonthChange: (m: string) => void;
  onDayChange: (d: string) => void;
}) {
  const days = daysInMonth(Number(month));
  return (
    <div className="flex gap-1.5 items-center">
      <select
        className={inputClass()}
        value={month}
        onChange={(e) => {
          onMonthChange(e.target.value);
          if (Number(day) > daysInMonth(Number(e.target.value)).length) onDayChange("1");
        }}
      >
        {MONTHS.map((m) => (
          <option key={m} value={m}>
            {m}月
          </option>
        ))}
      </select>
      <select className={inputClass()} value={day} onChange={(e) => onDayChange(e.target.value)}>
        {days.map((d) => (
          <option key={d} value={d}>
            {d}日
          </option>
        ))}
      </select>
    </div>
  );
}

export default function ReportPage() {
  const router = useRouter();
  const { userId, teamId, role } = useSession();
  const toast = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const today = new Date();
  const [month, setMonth] = useState(String(today.getMonth() + 1));
  const [day, setDay] = useState(String(today.getDate()));
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMonth, setEditMonth] = useState("1");
  const [editDay, setEditDay] = useState("1");
  const [editBody, setEditBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: r }, profMap] = await Promise.all([
      supabase.from("reports").select("*").order("created_at", { ascending: false }),
      loadProfilesMap(supabase),
    ]);
    setReports(r ?? []);
    setProfiles(profMap);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canAccessTab(role, "report")) router.replace("/schedule");
  }, [role, router]);

  async function handleSubmit() {
    if (!body.trim()) {
      toast("内容を入力してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("reports").insert({
      team_id: teamId,
      author_id: userId,
      date_label: `${month}/${day}`,
      body: body.trim(),
    });
    setSaving(false);
    if (error) {
      toast(`登録に失敗しました: ${error.message}`);
      return;
    }
    setMonth(String(today.getMonth() + 1));
    setDay(String(today.getDate()));
    setBody("");
    toast("日報を登録しました");
    load();
  }

  function startEdit(r: Report) {
    setEditingId(r.id);
    const parsed = parseDateLabel(r.date_label);
    setEditMonth(parsed.month);
    setEditDay(parsed.day);
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
      .from("reports")
      .update({ date_label: `${editMonth}/${editDay}`, body: editBody.trim() })
      .eq("id", id);
    setSavingEdit(false);
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }
    toast("日報を更新しました");
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
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    setDeleteConfirmId(null);
    setExpandedId(null);
    toast("日報を削除しました");
    load();
  }

  return (
    <PageShell header={<AppHeader title="練習日報" rightSlot={<CurrentUserBadge />} />}>
      <SectionLabel>日報を書く</SectionLabel>
      <Card>
        <FieldLabel>日付</FieldLabel>
        <MonthDaySelect month={month} day={day} onMonthChange={setMonth} onDayChange={setDay} />
        <div className="mt-3">
          <FieldLabel>内容</FieldLabel>
          <textarea
            rows={3}
            className={inputClass()}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="今日の練習についての気づきや共有事項"
          />
        </div>
        <SubmitButton onClick={handleSubmit} disabled={saving}>
          {saving ? "登録中…" : "登録する"}
        </SubmitButton>
      </Card>

      <SectionLabel>これまでの日報</SectionLabel>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : reports.length === 0 ? (
        <EmptyState>まだ日報がありません</EmptyState>
      ) : (
        reports.map((r) =>
          editingId === r.id ? (
            <Card key={r.id}>
              <FieldLabel>日付</FieldLabel>
              <MonthDaySelect month={editMonth} day={editDay} onMonthChange={setEditMonth} onDayChange={setEditDay} />
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
              onClick={() => canWriteReport(role) && setExpandedId(expandedId === r.id ? null : r.id)}
            >
              <div className="font-bold text-[14.5px]">{r.date_label || "日付未記入"}</div>
              <div className="text-xs text-ink-soft mt-1 whitespace-pre-wrap">{r.body}</div>
              <div className="text-xs text-ink-soft mt-1.5">
                {r.author_id ? (profiles[r.author_id] ?? "") : ""}
              </div>
              {expandedId === r.id && (
                <div className="flex gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
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
                    className="flex-1 text-center py-1.5 rounded-[8px] font-bold text-[11px] border bg-white"
                    style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                  >
                    {deleteConfirmId === r.id ? "もう一度タップで削除確定" : "削除"}
                  </button>
                </div>
              )}
            </Card>
          ),
        )
      )}
    </PageShell>
  );
}
