"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SegButton, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { canViewAttendanceReport } from "@/lib/permissions";
import { hasAttendanceReportAccess } from "@/lib/plan";
import { fiscalYearOf, fiscalYearRange, gradeLabel, playerFullName, sortPlayers, todayDateStr } from "@/lib/format";
import type { Database, ScheduleType } from "@/lib/database.types";

type ReportRow = Database["public"]["Functions"]["team_attendance_report"]["Returns"][number];

const SCHEDULE_TYPE_OPTIONS: { value: ScheduleType | null; label: string }[] = [
  { value: null, label: "すべて" },
  { value: "practice", label: "練習" },
  { value: "game", label: "試合" },
  { value: "event", label: "イベント" },
];

export default function AttendanceReportPage() {
  const router = useRouter();
  const { role, plan, category } = useSession();
  const toast = useToast();

  useEffect(() => {
    if (!canViewAttendanceReport(role) || !hasAttendanceReportAccess(plan)) router.replace("/team");
  }, [role, plan, router]);

  const defaultRange = fiscalYearRange(fiscalYearOf(todayDateStr()));
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [scheduleType, setScheduleType] = useState<ScheduleType | null>(null);
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleAggregate() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("team_attendance_report", {
        p_from: from,
        p_to: to,
        p_schedule_type: scheduleType,
      });
      if (error) {
        toast(`集計に失敗しました: ${error.message}`);
        return;
      }
      setRows(sortPlayers(data ?? []));
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (scheduleType) params.set("scheduleType", scheduleType);
      const res = await fetch(`/api/attendance-report/export?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast(json?.error ?? "出力に失敗しました");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "attendance_report.csv";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <PageShell header={<AppHeader title="出欠集計" variant="detail" backHref="/team" accessBadge="coach" />}>
      <SectionLabel>期間・予定種別</SectionLabel>
      <Card>
        <div className="flex gap-2.5">
          <div className="flex-1">
            <FieldLabel htmlFor="attendance-report-from">開始日</FieldLabel>
            <input
              id="attendance-report-from"
              type="date"
              className={inputClass()}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <FieldLabel htmlFor="attendance-report-to">終了日</FieldLabel>
            <input
              id="attendance-report-to"
              type="date"
              className={inputClass()}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <FieldLabel>予定種別</FieldLabel>
        <div className="flex gap-1.5">
          {SCHEDULE_TYPE_OPTIONS.map((opt) => (
            <SegButton key={opt.label} active={scheduleType === opt.value} onClick={() => setScheduleType(opt.value)}>
              {opt.label}
            </SegButton>
          ))}
        </div>
        <SubmitButton onClick={handleAggregate} disabled={loading || !from || !to}>
          {loading ? "集計中…" : "この条件で集計する"}
        </SubmitButton>
      </Card>

      {rows !== null && (
        <>
          <SectionLabel
            action={
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || rows.length === 0}
                className="flex-none px-3 py-1.5 rounded-lg border border-line text-[11px] font-bold text-ink-soft bg-paper disabled:opacity-50"
              >
                {exporting ? "出力中…" : "CSV出力"}
              </button>
            }
          >
            集計結果({rows.length}名)
          </SectionLabel>
          {rows.length === 0 ? (
            <EmptyState>対象の予定がありません</EmptyState>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-ink-soft text-[10.5px]">
                    <th className="text-left pb-2 pr-2 whitespace-nowrap">選手</th>
                    <th className="text-right pb-2 px-1.5 whitespace-nowrap">対象</th>
                    <th className="text-right pb-2 px-1.5 whitespace-nowrap">出席</th>
                    <th className="text-right pb-2 px-1.5 whitespace-nowrap">欠席</th>
                    <th className="text-right pb-2 px-1.5 whitespace-nowrap">遅刻早退</th>
                    <th className="text-right pb-2 px-1.5 whitespace-nowrap">見学</th>
                    <th className="text-right pb-2 pl-1.5 whitespace-nowrap">出席率</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.player_id} className="border-t border-line">
                      <td className="py-2 pr-2 font-bold whitespace-nowrap">
                        {playerFullName(r)}
                        <span className="text-ink-soft font-normal ml-1">{gradeLabel(r.grade, category)}</span>
                      </td>
                      <td className="text-right py-2 px-1.5 font-mono">{r.eligible_count}</td>
                      <td className="text-right py-2 px-1.5 font-mono">{r.present_count}</td>
                      <td className="text-right py-2 px-1.5 font-mono">{r.absent_count}</td>
                      <td className="text-right py-2 px-1.5 font-mono">{r.late_count}</td>
                      <td className="text-right py-2 px-1.5 font-mono">{r.observe_count}</td>
                      <td className="text-right py-2 pl-1.5 font-mono">
                        {r.eligible_count > 0 ? `${Math.round((r.present_count / r.eligible_count) * 1000) / 10}%` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </PageShell>
  );
}
