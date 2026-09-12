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
import { ReactionSummary } from "@/components/ReactionButtons";
import { hasCachedValue, useCachedState } from "@/lib/pageCache";
import { canAccessTab } from "@/lib/permissions";
import { markTabSeen } from "@/lib/tabBadges";
import { computeUnseenDailyReportIds } from "@/lib/itemBadges";
import { currentYearMonth, dateDaysAgoStr, formatFullDateLabel, monthRangeBounds } from "@/lib/format";
import { FREE_REPORT_WINDOW_DAYS, hasFullReportHistoryAccess } from "@/lib/plan";
import type { DailyReport, DailyReportReaction } from "@/lib/database.types";
import { NewDailyReportModal } from "./NewDailyReportModal";

// 1回のDB取得件数の上限。従来は月内(またはお試しプランの閲覧可能期間内)の
// 全件を無制限に取得していたため、投稿数が多い月では取得件数が際限なく
// 伸びる問題があった(docs/load-handling-todo.md)。CollapsibleListによる
// 「もっと見る」(読み込み済み分を5件ずつ表示)とは別に、読み込み済み分を
// すべて表示し終えてもまだ範囲内に残りがある場合はDBへ追加取得する。
const REPORT_PAGE_SIZE = 30;

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
  const [reactions, setReactions] = useCachedState<DailyReportReaction[]>(cacheKey("reactions"), []);
  const [loading, setLoading] = useState(() => !hasCachedValue(cacheKey("reports")));
  const [unseenIds, setUnseenIds] = useCachedState<Set<string>>("report:unseenIds", new Set());
  const [hasMore, setHasMore] = useCachedState<boolean>(cacheKey("hasMore"), false);
  const [loadingMore, setLoadingMore] = useState(false);

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
      .order("created_at", { ascending: false })
      .limit(REPORT_PAGE_SIZE + 1);
    const page = (r ?? []).slice(0, REPORT_PAGE_SIZE);
    setHasMore((r?.length ?? 0) > REPORT_PAGE_SIZE);
    setReports(page);
    const reportIds = page.map((x) => x.id);
    if (reportIds.length > 0) {
      const { data: rc } = await supabase.from("daily_report_reactions").select("*").in("daily_report_id", reportIds);
      setReactions(rc ?? []);
    } else {
      setReactions([]);
    }
    setLoading(false);
  }, [monthValue, earliestAllowedDate, cacheKey, setReports, setReactions, setHasMore]);

  async function loadMore() {
    if (reports.length === 0 || loadingMore) return;
    setLoadingMore(true);
    const supabase = createClient();
    const { start, end } = monthRangeBounds(monthValue);
    const effectiveStart = earliestAllowedDate && earliestAllowedDate > start ? earliestAllowedDate : start;
    const cursor = reports[reports.length - 1].created_at;
    const { data: r } = await supabase
      .from("daily_reports")
      .select("*")
      .gte("date", effectiveStart)
      .lt("date", end)
      .lt("created_at", cursor)
      .order("created_at", { ascending: false })
      .limit(REPORT_PAGE_SIZE + 1);
    const page = (r ?? []).slice(0, REPORT_PAGE_SIZE);
    setHasMore((r?.length ?? 0) > REPORT_PAGE_SIZE);
    if (page.length > 0) {
      setReports((prev) => [...prev, ...page]);
      const reportIds = page.map((x) => x.id);
      const { data: rc } = await supabase.from("daily_report_reactions").select("*").in("daily_report_id", reportIds);
      setReactions((prev) => [...prev, ...(rc ?? [])]);
    }
    setLoadingMore(false);
  }

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
        <>
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
                  <ReactionSummary reactions={reactions.filter((rc) => rc.daily_report_id === r.id)} />
                </Card>
              </Link>
            )}
          />
          {showAll && hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="block w-full mt-1 mb-2.5 text-center py-2 rounded-lg font-bold text-[12px] border border-line text-ink-soft bg-paper"
            >
              {loadingMore ? "読み込み中…" : "さらに読み込む"}
            </button>
          )}
        </>
      )}
    </PageShell>
  );
}
