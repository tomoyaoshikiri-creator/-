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
import { hasKarteTabAccess } from "@/lib/plan";
import { fiscalYearLabel, fiscalYearOf, formatDateLabel, todayDateStr } from "@/lib/format";
import type { PracticeMenu, Schedule } from "@/lib/database.types";

interface PracticeWithMenus extends Schedule {
  menus: PracticeMenu[];
}

interface MenuTally {
  theme: string;
  count: number;
  entries: { scheduleId: string; date: string }[];
}

export default function KarteTeamWorkoutPage() {
  const router = useRouter();
  const { role, plan } = useSession();
  const [practices, setPractices] = useState<PracticeWithMenus[]>([]);
  const [fiscalYear, setFiscalYear] = useState<number | "all">("all");
  const [yearInitialized, setYearInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyMode, setHistoryMode] = useState(false);
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null);

  useEffect(() => {
    if (!canViewKarte(role) || !hasKarteTabAccess(plan)) router.replace("/schedule");
  }, [role, plan, router]);

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

  const tallyMap = new Map<string, MenuTally>();
  filtered.forEach((p) => {
    p.menus.forEach((m) => {
      const theme = (m.theme ?? "").trim();
      if (!theme) return;
      const existing = tallyMap.get(theme);
      const entry = { scheduleId: p.id, date: p.date };
      if (existing) {
        existing.count += 1;
        existing.entries.push(entry);
      } else {
        tallyMap.set(theme, { theme, count: 1, entries: [entry] });
      }
    });
  });
  const tallies = Array.from(tallyMap.values())
    .map((t) => ({ ...t, entries: t.entries.slice().sort((a, b) => b.date.localeCompare(a.date)) }))
    .sort((a, b) => b.count - a.count || b.entries[0].date.localeCompare(a.entries[0].date));

  return (
    <PageShell
      header={<AppHeader title="ワークアウト" variant="detail" backHref="/karte/team" accessBadge="coach" />}
    >
      <div className="flex items-center gap-2 mb-3.5 flex-wrap">
        {availableYears.length > 0 && (
          <div className="relative inline-block">
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
        <button
          type="button"
          onClick={() => setHistoryMode((v) => !v)}
          className={`flex-none text-center px-5 py-2 rounded-[10px] font-bold text-[13px] border ${
            historyMode ? "border-orange bg-orange text-white" : "border-line text-ink-soft bg-white"
          }`}
        >
          {historyMode ? "履歴表示中" : "日付の履歴で見る"}
        </button>
      </div>

      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : historyMode ? (
        filtered.length === 0 ? (
          <EmptyState>練習の記録がありません</EmptyState>
        ) : (
          <>
            <SectionLabel>練習履歴({filtered.length}件)</SectionLabel>
            {filtered.map((p) => (
              <Link key={p.id} href={`/schedule/${p.id}`}>
                <div className="bg-white border border-line rounded-2xl px-3.5 py-2.5 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="text-[10.5px] text-ink-soft flex-shrink-0 w-[46px]">
                      {formatDateLabel(p.date)}
                    </div>
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
        )
      ) : tallies.length === 0 ? (
        <EmptyState>練習メニューの記録がありません</EmptyState>
      ) : (
        <>
          <SectionLabel>実施メニューの集計({tallies.length}種類)</SectionLabel>
          {tallies.map((t) => (
            <div key={t.theme} className="bg-white border border-line rounded-2xl px-3.5 py-2.5 mb-2">
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => setExpandedTheme(expandedTheme === t.theme ? null : t.theme)}
              >
                <div className="font-bold text-[13.5px] flex-1 min-w-0">{t.theme}</div>
                <div className="font-mono font-bold text-[13px] text-orange flex-shrink-0">{t.count}回</div>
                <div className="text-[10.5px] text-ink-soft flex-shrink-0 w-[46px] text-right">
                  {formatDateLabel(t.entries[0].date)}
                </div>
              </div>
              {expandedTheme === t.theme && (
                <ul className="mt-2 pt-2 border-t border-line space-y-1">
                  {t.entries.map((e, idx) => (
                    <li key={`${e.scheduleId}-${idx}`}>
                      <Link href={`/schedule/${e.scheduleId}`} className="text-[12px] text-ink-soft">
                        {formatDateLabel(e.date)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </>
      )}
    </PageShell>
  );
}
