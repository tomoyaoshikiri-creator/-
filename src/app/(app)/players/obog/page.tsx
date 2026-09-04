"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState } from "@/components/ui/Card";
import { FieldLabel } from "@/components/ui/SegButton";
import { ChevronRightIcon } from "@/components/icons";
import { PlayerRow } from "@/components/PlayerRow";
import { canManagePlayers } from "@/lib/permissions";
import { fiscalYearOf, obogGraduationFiscalYear, sortPlayers, todayDateStr } from "@/lib/format";
import { computeUnseenPlayerNoteIds } from "@/lib/itemBadges";
import type { Player } from "@/lib/database.types";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());

export default function ObogPage() {
  const { role, userId, category } = useSession();
  const isStaff = canManagePlayers(role);
  const [players, setPlayers] = useState<Player[]>([]);
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [unseenNoteIds, setUnseenNoteIds] = useState<Set<string>>(new Set());
  const [ownPlayerIds, setOwnPlayerIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      setLoading(true);
      const { data } = await supabase.from("players").select("*").eq("status", "OB・OG");
      const list = sortPlayers(data ?? []);
      setPlayers(list);
      // メモは指導者・管理者専用の情報なので、それ以外のロール(保護者)では取得しない。
      if (list.length > 0 && isStaff) {
        const { data: notes } = await supabase.from("player_notes").select("player_id");
        const counts: Record<string, number> = {};
        (notes ?? []).forEach((n) => {
          counts[n.player_id] = (counts[n.player_id] ?? 0) + 1;
        });
        setNoteCounts(counts);
        computeUnseenPlayerNoteIds(userId).then(setUnseenNoteIds);
      } else {
        setNoteCounts({});
        setUnseenNoteIds(new Set());
      }
      // 保護者(一般・運営)は一覧にチーム全OB・OGが出るが、自分の子ども以外は選べないようにする。
      if (!isStaff) {
        const { data: pg } = await supabase.from("player_guardians").select("player_id").eq("profile_id", userId);
        setOwnPlayerIds(new Set((pg ?? []).map((g) => g.player_id)));
      }
      setLoading(false);
    })();
  }, [isStaff, userId]);

  const withYear = players
    .map((p) => ({ player: p, year: obogGraduationFiscalYear(p.grade, category, CURRENT_FISCAL_YEAR) }))
    .filter((v): v is { player: Player; year: number } => v.year !== null);
  const years = Array.from(new Set(withYear.map((v) => v.year))).sort((a, b) => b - a);
  const year = selectedYear ?? years[0] ?? CURRENT_FISCAL_YEAR - 1;
  const yearMembers = withYear.filter((v) => v.year === year).map((v) => v.player);

  return (
    <PageShell
      header={
        <AppHeader title="OB・OG" variant="detail" backHref="/players" accessBadge={isStaff ? "coach" : undefined} />
      }
    >
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : players.length === 0 ? (
        <EmptyState>OB・OGはいません</EmptyState>
      ) : (
        <>
          <FieldLabel>卒業年度</FieldLabel>
          <div className="relative inline-block mb-3">
            <select
              className="appearance-none bg-white border border-line rounded-lg pl-3 pr-8 py-1.5 text-[12.5px] font-bold text-ink"
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
                <PlayerRow
                  key={p.id}
                  player={p}
                  noteCount={noteCounts[p.id] ?? 0}
                  showNotes={isStaff}
                  selectable={isStaff || ownPlayerIds.has(p.id)}
                  hasUnseenNotes={unseenNoteIds.has(p.id)}
                />
              ))
            )}
          </Card>
        </>
      )}
    </PageShell>
  );
}
