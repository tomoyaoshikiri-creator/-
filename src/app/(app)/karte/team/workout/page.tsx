"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { EmptyState, SectionLabel } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { canViewKarte } from "@/lib/permissions";
import { fiscalYearLabel, fiscalYearOf, formatDateLabel, todayDateStr } from "@/lib/format";
import type { PracticeMenu, Schedule } from "@/lib/database.types";

interface PracticeWithMenus extends Schedule {
  menus: PracticeMenu[];
}

export default function KarteTeamWorkoutPage() {
  const router = useRouter();
  const { role } = useSession();
  const [practices, setPractices] = useState<PracticeWithMenus[]>([]);
  const [fiscalYear, setFiscalYear] = useState<number | "all">("all");
  const [yearInitialized, setYearInitialized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canViewKarte(role)) router.replace("/schedule");
  }, [role, router]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: schedules } = await supabase
        .from("schedules")
        .select("*")
        .eq("type", "practice")
        .lte("date", todayDateStr())
        .order("date", { ascending: false });

      const scheduleIds = (schedules ?? []).map((s) => s.id);
      let menus: PracticeMenu[] = [];
      if (scheduleIds.length > 0) {
        const { data } = await supabase
          .from("practice_menus")
          .select("*")
          .in("schedule_id", scheduleIds)
          .order("updated_at", { ascending: true });
        menus = data ?? [];
      }

      const combined: PracticeWithMenus[] = (schedules ?? []).map((s) => ({
        ...s,
        menus: menus.filter((m) => m.schedule_id === s.id),
      }));
      setPractices(combined);
      setLoading(false);
      if (!yearInitialized && combined.length > 0) {
        setFiscalYear(fiscalYearOf(combined[0].date));
        setYearInitialized(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableYears = Array.from(new Set(practices.map((p) => fiscalYearOf(p.date)))).sort((a, b) => b - a);
  const filtered = fiscalYear === "all" ? practices : practices.filter((p) => fiscalYearOf(p.date) === fiscalYear);

  return (
    <PageShell
      header={<AppHeader title="ワークアウト" variant="detail" backHref="/karte/team" accessBadge="coach" />}
    >
      {availableYears.length > 0 && (
        <div className="relative inline-block mb-3.5">
          <select
            className="appearance-none bg-white border border-line rounded-[10px] pl-3 pr-8 py-1.5 text-[12.5px] font-bold text-ink"
            value={fiscalYear === "all" ? "all" : String(fiscalYear)}
            onChange={(e) => setFiscalYear(e.target.value === "all" ? "all" : Number(e.target.value))}
          >
            <option value="all">すべての年度</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {fiscalYearLabel(y)}
              </option>
            ))}
          </select>
          <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
        </div>
      )}

      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState>練習の記録がありません</EmptyState>
      ) : (
        <>
          <SectionLabel>練習履歴({filtered.length}件)</SectionLabel>
          {filtered.map((p) => (
            <Link key={p.id} href={`/schedule/${p.id}`}>
              <div className="bg-white border border-line rounded-2xl px-3.5 py-2.5 mb-2">
                <div className="flex items-center gap-2">
                  <div className="text-[10.5px] text-ink-soft flex-shrink-0 w-[46px]">{formatDateLabel(p.date)}</div>
                  <div className="font-bold text-[12.5px] flex-1 min-w-0 truncate">{p.title}</div>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
                </div>
                {p.menus.length > 0 ? (
                  <ul className="mt-1.5 pl-[54px] list-disc text-[12px] text-ink space-y-0.5">
                    {p.menus.map((m) => (
                      <li key={m.id}>{m.theme}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-1.5 pl-[54px] text-[11.5px] text-ink-soft">メニュー未登録</div>
                )}
              </div>
            </Link>
          ))}
        </>
      )}
    </PageShell>
  );
}
