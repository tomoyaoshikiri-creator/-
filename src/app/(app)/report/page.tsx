"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { Fab } from "@/components/ui/Modal";
import { ChevronRightIcon } from "@/components/icons";
import { MonthPicker } from "@/components/MonthPicker";
import { CollapsibleList } from "@/components/CollapsibleList";
import { hasCachedValue, useCachedState } from "@/lib/pageCache";
import { canAccessTab } from "@/lib/permissions";
import { markTabSeen } from "@/lib/tabBadges";
import { computeUnseenDailyReportIds } from "@/lib/itemBadges";
import { currentYearMonth, dateDaysAgoStr, formatFullDateLabel, monthRangeBounds } from "@/lib/format";
import { FREE_REPORT_WINDOW_DAYS, hasFullReportHistoryAccess } from "@/lib/plan";
import type { DailyReport } from "@/lib/database.types";
import { NewDailyReportModal } from "./NewDailyReportModal";

export default function ReportPage() {
  const router = useRouter();
  const { userId, role, plan } = useSession();
  const hasFullHistory = hasFullReportHistoryAccess(plan);
  const earliestAllowedDate = hasFullHistory ? null : dateDaysAgoStr(FREE_REPORT_WINDOW_DAYS - 1);
  const earliestAllowedYearMonth = earliestAllowedDate ? earliestAllowedDate.slice(0, 7) : undefined;
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [monthValue, setMonthValue] = useState(currentYearMonth());
  const [showAll, setShowAll] = useState(false);
  const cacheKey = useCallback((field: string) => `report:${monthValue}:${field}`, [monthValue]);
  const [reports, setReports] = useCachedState<DailyReport[]>(cacheKey("reports"), []);
  const [loading, setLoading] = useState(() => !hasCachedValue(cacheKey("reports")));
  const [unseenIds, setUnseenIds] = useCachedState<Set<string>>("report:unseenIds", new Set());

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!hasCachedValue(cacheKey("reports"))) setLoading(true);
    const { start, end } = monthRangeBounds(monthValue);
    const effectiveStart = earliestAllowedDate && earliestAllowedDate > start ? earliestAllowedDate : start;
    const { data: r } = await supabase
      .from("daily_reports")
      .select("*")
      .gte("date", effectiveStart)
      .lt("date", end)
      .order("created_at", { ascending: false });
    setReports(r ?? []);
    setLoading(false);
  }, [monthValue, earliestAllowedDate, cacheKey, setReports]);

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
    if (!canAccessTab(role, "report")) router.replace("/home");
  }, [role, router]);

  return (
    <PageShell
      header={<AppHeader title="チーム日報" variant="detail" backHref="/team" />}
      fab={
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
      }
    >
      <SectionLabel>チーム日報一覧</SectionLabel>
      <MonthPicker value={monthValue} onChange={setMonthValue} min={earliestAllowedYearMonth} />
      {!hasFullHistory && (
        <div className="text-[11px] text-ink-soft bg-paper border border-line rounded-lg px-3 py-2 mb-3">
          お試しプランでは直近{FREE_REPORT_WINDOW_DAYS}日分のみ閲覧できます。中間プラン以上で過去の日報もすべて見られるようになります。
        </div>
      )}
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : reports.length === 0 ? (
        <EmptyState>この月のチーム日報はありません</EmptyState>
      ) : (
        <CollapsibleList
          items={reports}
          showAll={showAll}
          onShowAll={() => setShowAll(true)}
          renderItem={(r) => (
            <Link key={r.id} href={`/report/${r.id}`}>
              <Card className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[14.5px] flex items-center gap-1.5">
                    {unseenIds.has(r.id) && (
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-danger/10 text-danger">
                        NEW
                      </span>
                    )}
                    {formatFullDateLabel(r.date)}
                  </div>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
                </div>
              </Card>
            </Link>
          )}
        />
      )}
    </PageShell>
  );
}
