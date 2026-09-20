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
import { hasCoachNoteAccess } from "@/lib/plan";
import { loadProfilesMap } from "@/lib/profiles";
import { markTabSeen } from "@/lib/tabBadges";
import { computeUnseenCoachNoteIds } from "@/lib/itemBadges";
import { currentYearMonth, formatFullDateLabel, monthRangeBounds } from "@/lib/format";
import type { Report, ReportReaction } from "@/lib/database.types";
import { NewCoachNoteModal } from "./NewCoachNoteModal";

// 1回のDB取得件数の上限(notice/report等の他の一覧画面と同じ考え方、
// docs/load-handling-todo.md参照)。
const COACH_NOTE_PAGE_SIZE = 30;

export default function CoachNotePage() {
  const router = useRouter();
  const { userId, role, plan } = useSession();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [monthValue, setMonthValue] = useState(currentYearMonth());
  const [showAll, setShowAll] = useState(false);
  const cacheKey = useCallback((field: string) => `coachNote:${monthValue}:${field}`, [monthValue]);
  const [reports, setReports] = useCachedState<Report[]>(cacheKey("reports"), []);
  const [reactions, setReactions] = useCachedState<ReportReaction[]>(cacheKey("reactions"), []);
  const [profiles, setProfiles] = useCachedState<Record<string, string>>(cacheKey("profiles"), {});
  const [loading, setLoading] = useState(() => !hasCachedValue(cacheKey("reports")));
  const [unseenIds, setUnseenIds] = useCachedState<Set<string>>("coachNote:unseenIds", new Set());
  const [hasMore, setHasMore] = useCachedState<boolean>(cacheKey("hasMore"), false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!hasCachedValue(cacheKey("reports"))) setLoading(true);
    const { start, end } = monthRangeBounds(monthValue);
    const [{ data: r }, profMap] = await Promise.all([
      supabase
        .from("reports")
        .select("*")
        .gte("date", start)
        .lt("date", end)
        .order("created_at", { ascending: false })
        .limit(COACH_NOTE_PAGE_SIZE + 1),
      loadProfilesMap(supabase),
    ]);
    const page = (r ?? []).slice(0, COACH_NOTE_PAGE_SIZE);
    setHasMore((r?.length ?? 0) > COACH_NOTE_PAGE_SIZE);
    setReports(page);
    setProfiles(profMap);
    const reportIds = page.map((x) => x.id);
    if (reportIds.length > 0) {
      const { data: rc } = await supabase.from("report_reactions").select("*").in("report_id", reportIds);
      setReactions(rc ?? []);
    } else {
      setReactions([]);
    }
    setLoading(false);
  }, [monthValue, cacheKey, setReports, setProfiles, setReactions, setHasMore]);

  async function loadMore() {
    if (reports.length === 0 || loadingMore) return;
    setLoadingMore(true);
    const supabase = createClient();
    const { start, end } = monthRangeBounds(monthValue);
    const cursor = reports[reports.length - 1].created_at;
    const { data: r } = await supabase
      .from("reports")
      .select("*")
      .gte("date", start)
      .lt("date", end)
      .lt("created_at", cursor)
      .order("created_at", { ascending: false })
      .limit(COACH_NOTE_PAGE_SIZE + 1);
    const page = (r ?? []).slice(0, COACH_NOTE_PAGE_SIZE);
    setHasMore((r?.length ?? 0) > COACH_NOTE_PAGE_SIZE);
    if (page.length > 0) {
      setReports((prev) => [...prev, ...page]);
      const reportIds = page.map((x) => x.id);
      const { data: rc } = await supabase.from("report_reactions").select("*").in("report_id", reportIds);
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
    markTabSeen(userId, "coachNote");
  }, [userId]);

  useEffect(() => {
    computeUnseenCoachNoteIds(userId).then(setUnseenIds);
  }, [userId, setUnseenIds]);

  useEffect(() => {
    if (!canAccessTab(role, "coachNote") || !hasCoachNoteAccess(plan)) router.replace("/home");
  }, [role, plan, router]);

  return (
    <PageShell
      header={<AppHeader title="コーチ日報" variant="detail" backHref="/team" accessBadge="coach" />}
      fab={
        <>
          <Fab onClick={() => setModalOpen(true)} />
          <NewCoachNoteModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onCreated={() => {
              setModalOpen(false);
              load();
              toast("コーチ日報を登録しました");
            }}
          />
        </>
      }
    >
      <SectionLabel>コーチ日報一覧</SectionLabel>
      <MonthPicker value={monthValue} onChange={setMonthValue} />
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : reports.length === 0 ? (
        <EmptyState>この月のコーチ日報はありません</EmptyState>
      ) : (
        <>
          <CollapsibleList
            items={reports}
            showAll={showAll}
            onShowAll={() => setShowAll(true)}
            renderItem={(r) => (
              <Link key={r.id} href={`/coach-note/${r.id}`}>
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
                  {r.author_id && profiles[r.author_id] && (
                    <div className="text-xs text-ink-soft mt-0.5">{profiles[r.author_id]}</div>
                  )}
                  <ReactionSummary reactions={reactions.filter((rc) => rc.report_id === r.id)} />
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
