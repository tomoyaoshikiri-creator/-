"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { canAccessTab, canWriteReport } from "@/lib/permissions";
import { loadProfilesMap } from "@/lib/profiles";
import { formatFullDateLabel } from "@/lib/format";
import type { Report } from "@/lib/database.types";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// 実際の日付(年入り)を1つのselect(スクロール)で選べるようにする。過去2年分をカバーしておけば、
// 編集時に既存の日報の日付が選択肢から外れることはまず無い。
const DATE_OPTIONS: { value: string; label: string }[] = (() => {
  const options: { value: string; label: string }[] = [];
  const today = new Date();
  for (let i = 730; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    options.push({ value, label: formatFullDateLabel(value) });
  }
  return options;
})();

function DateSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // 編集対象の日付が選択肢の範囲外(2年より前)だった場合に備えて、無ければ選択肢に足しておく。
  const options = DATE_OPTIONS.some((o) => o.value === value)
    ? DATE_OPTIONS
    : [{ value, label: formatFullDateLabel(value) }, ...DATE_OPTIONS];
  return (
    <select className={inputClass()} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default function ReportPage() {
  const router = useRouter();
  const { userId, teamId, role } = useSession();
  const toast = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const todayValue = DATE_OPTIONS[DATE_OPTIONS.length - 1].value;
  const [dateValue, setDateValue] = useState(todayValue);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDateValue, setEditDateValue] = useState(todayValue);
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
      date: dateValue,
      body: body.trim(),
    });
    setSaving(false);
    if (error) {
      toast(`登録に失敗しました: ${error.message}`);
      return;
    }
    setDateValue(todayValue);
    setBody("");
    toast("日報を登録しました");
    load();
  }

  function startEdit(r: Report) {
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
      .from("reports")
      .update({ date: editDateValue, body: editBody.trim() })
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
    <PageShell header={<AppHeader title="練習日報" />}>
      <SectionLabel>日報を書く</SectionLabel>
      <Card>
        <FieldLabel>日付</FieldLabel>
        <DateSelect value={dateValue} onChange={setDateValue} />
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
              onClick={() => canWriteReport(role) && setExpandedId(expandedId === r.id ? null : r.id)}
            >
              <div className="font-bold text-[14.5px]">{formatFullDateLabel(r.date)}</div>
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
