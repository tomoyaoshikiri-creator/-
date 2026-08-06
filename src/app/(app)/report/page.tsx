"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { CurrentUserBadge } from "@/components/CurrentUserBadge";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { loadProfilesMap } from "@/lib/profiles";
import type { Report } from "@/lib/database.types";

export default function ReportPage() {
  const { userId, teamId } = useSession();
  const toast = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [dateLabel, setDateLabel] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      date_label: dateLabel.trim() || null,
      body: body.trim(),
    });
    setSaving(false);
    if (error) {
      toast(`登録に失敗しました: ${error.message}`);
      return;
    }
    setDateLabel("");
    setBody("");
    toast("日報を登録しました");
    load();
  }

  return (
    <PageShell header={<AppHeader title="練習日報" rightSlot={<CurrentUserBadge />} />}>
      <SectionLabel>日報を書く</SectionLabel>
      <Card>
        <FieldLabel>日付</FieldLabel>
        <input
          className={inputClass()}
          value={dateLabel}
          onChange={(e) => setDateLabel(e.target.value)}
          placeholder="例:8/10"
        />
        <div className="mt-3">
          <FieldLabel>内容</FieldLabel>
          <textarea
            rows={3}
            className={inputClass()}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="今日の練習の様子や気づきを記入"
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
        reports.map((r) => (
          <Card key={r.id}>
            <div className="font-bold text-[14.5px]">{r.date_label || "日付未記入"}</div>
            <div className="text-xs text-ink-soft mt-1 whitespace-pre-wrap">{r.body}</div>
            <div className="text-xs text-ink-soft mt-1.5">
              {r.author_id ? (profiles[r.author_id] ?? "") : ""}
            </div>
          </Card>
        ))
      )}
    </PageShell>
  );
}
