"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState } from "@/components/ui/Card";
import { FieldLabel } from "@/components/ui/SegButton";
import { NumChip } from "@/components/ui/Pill";
import { ChevronRightIcon } from "@/components/icons";
import { canViewKarte } from "@/lib/permissions";
import { fiscalYearOf, obogGraduationFiscalYear, playerFullName, sortPlayers, todayDateStr } from "@/lib/format";
import type { Player } from "@/lib/database.types";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());

export default function KarteObogPage() {
  const router = useRouter();
  const { role } = useSession();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    if (!canViewKarte(role)) router.replace("/schedule");
  }, [role, router]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      setLoading(true);
      const { data } = await supabase.from("players").select("*").eq("status", "OB・OG");
      setPlayers(sortPlayers(data ?? []));
      setLoading(false);
    })();
  }, []);

  const withYear = players
    .map((p) => ({ player: p, year: obogGraduationFiscalYear(p.grade, CURRENT_FISCAL_YEAR) }))
    .filter((v): v is { player: Player; year: number } => v.year !== null);
  const years = Array.from(new Set(withYear.map((v) => v.year))).sort((a, b) => b - a);
  const year = selectedYear ?? years[0] ?? CURRENT_FISCAL_YEAR - 1;
  const yearMembers = withYear.filter((v) => v.year === year).map((v) => v.player);

  return (
    <PageShell header={<AppHeader title="OB・OG" variant="detail" backHref="/karte/players" accessBadge="coach" />}>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : players.length === 0 ? (
        <EmptyState>OB・OGはいません</EmptyState>
      ) : (
        <>
          <FieldLabel>卒業年度</FieldLabel>
          <div className="relative inline-block mb-3">
            <select
              className="appearance-none bg-white border border-line rounded-[10px] pl-3 pr-8 py-1.5 text-[12.5px] font-bold text-ink"
              value={year}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}年度
                </option>
              ))}
            </select>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
          </div>

          <Card>
            {yearMembers.length === 0 ? (
              <EmptyState>この年度に卒団した選手はいません</EmptyState>
            ) : (
              yearMembers.map((p) => (
                <Link
                  key={p.id}
                  href={`/karte/players/${p.id}`}
                  className="flex items-center gap-2.5 py-2.5 border-b border-line last:border-b-0"
                >
                  <NumChip num={p.number ?? "-"} muted />
                  <div className="flex-1">
                    <div className="font-bold text-[13.5px]">{playerFullName(p)}</div>
                    <div className="text-[11px] text-ink-soft mt-0.5">{p.positions.join("/")}</div>
                  </div>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
                </Link>
              ))
            )}
          </Card>
        </>
      )}
    </PageShell>
  );
}
