"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState } from "@/components/ui/Card";
import { FieldLabel } from "@/components/ui/SegButton";
import { InlineSelect } from "@/components/ui/InlineSelect";
import { KartePlayerRow } from "@/components/KartePlayerRow";
import { canViewKarte } from "@/lib/permissions";
import { hasKarteTabAccess } from "@/lib/plan";
import { fiscalYearOf, obogGraduationFiscalYear, sortPlayers, todayDateStr } from "@/lib/format";
import { computeUnseenPlayerAnalysisIds } from "@/lib/itemBadges";
import type { Player } from "@/lib/database.types";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());

export default function KarteObogPage() {
  const router = useRouter();
  const { role, userId, plan, category } = useSession();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [unseenAnalysisIds, setUnseenAnalysisIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!canViewKarte(role) || !hasKarteTabAccess(plan)) router.replace("/home");
  }, [role, plan, router]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      setLoading(true);
      const { data } = await supabase.from("players").select("*").eq("status", "OB・OG");
      setPlayers(sortPlayers(data ?? []));
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    computeUnseenPlayerAnalysisIds(userId).then(setUnseenAnalysisIds);
  }, [userId]);

  const withYear = players
    .map((p) => ({ player: p, year: obogGraduationFiscalYear(p.grade, category, CURRENT_FISCAL_YEAR) }))
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
          <InlineSelect
            className="mb-3"
            value={String(year)}
            onChange={(v) => setSelectedYear(Number(v))}
            options={years.map((y) => ({ value: String(y), label: `${y}年度` }))}
          />

          <Card>
            {yearMembers.length === 0 ? (
              <EmptyState>この年度に卒団した選手はいません</EmptyState>
            ) : (
              yearMembers.map((p) => (
                <KartePlayerRow key={p.id} player={p} hasUnseenAnalysis={unseenAnalysisIds.has(p.id)} />
              ))
            )}
          </Card>
        </>
      )}
    </PageShell>
  );
}
