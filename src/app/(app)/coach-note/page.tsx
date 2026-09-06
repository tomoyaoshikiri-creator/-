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
import { markTabSeen } from "@/lib/tabBadges";
import { computeUnseenCoachNoteIds } from "@/lib/itemBadges";
import { currentYearMonth, formatFullDateLabel, monthRangeBounds } from "@/lib/format";
import type { Report, ReportReaction } from "@/lib/database.types";
import { NewCoachNoteModal } from "./NewCoachNoteModal";

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
  const [loading, setLoading] = useState(() => !hasCachedValue(cacheKey("reports")));
  const [unseenIds, setUnseenIds] = useCachedState<Set<string>>("coachNote:unseenIds", new Set());

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!hasCachedValue(cacheKey("reports"))) setLoading(true);
    const { start, end } = monthRangeBounds(monthValue);
    const { data: r } = await supabase
      .from("reports")
      .select("*")
      .gte("date", start)
      .lt("date", end)
      .order("created_at", { ascending: false });
    setReports(r ?? []);
    const reportIds = (r ?? []).map((x) => x.id);
    if (reportIds.length > 0) {
      const { data: rc } = await supabase.from("report_reactions").select("*").in("report_id", reportIds);
      setReactions(rc ?? []);
    } else {
      setReactions([]);
    }
    setLoading(false);
  }, [monthValue, cacheKey, setReports, setReactions]);

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
                <ReactionSummary reactions={reactions.filter((rc) => rc.report_id === r.id)} />
              </Card>
            </Link>
          )}
        />
      )}
    </PageShell>
  );
}
