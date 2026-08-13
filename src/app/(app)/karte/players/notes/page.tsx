"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { NumChip } from "@/components/ui/Pill";
import { ChevronRightIcon } from "@/components/icons";
import { canViewKarte } from "@/lib/permissions";
import { gradeLabel, playerFullName, sortPlayers } from "@/lib/format";
import type { Player } from "@/lib/database.types";

function PlayerNoteRow({ player, noteCount }: { player: Player; noteCount: number }) {
  const hasNotes = noteCount > 0;
  const isObog = player.status === "OB・OG";
  return (
    <Link
      href={`/players/${player.id}/notes`}
      className="flex items-center gap-2.5 py-2.5 border-b border-line last:border-b-0"
    >
      <NumChip num={player.number ?? "-"} muted={isObog} />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-[13.5px]">{playerFullName(player)}</div>
        <div className="text-[11px] text-ink-soft mt-0.5">
          {gradeLabel(player.grade)}・{player.positions.join("/")}
        </div>
      </div>
      <div
        className={`flex-shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md border whitespace-nowrap ${
          hasNotes ? "border-danger text-danger bg-danger/8" : "border-line text-ink bg-white"
        }`}
      >
        {hasNotes ? `メモあり(${noteCount}件)` : "メモなし"}
      </div>
      <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
    </Link>
  );
}

export default function KartePlayerNotesListPage() {
  const router = useRouter();
  const { role } = useSession();
  const [players, setPlayers] = useState<Player[]>([]);
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: p }, { data: notes }] = await Promise.all([
      supabase.from("players").select("*"),
      supabase.from("player_notes").select("player_id"),
    ]);
    setPlayers(sortPlayers(p ?? []));
    const counts: Record<string, number> = {};
    (notes ?? []).forEach((n) => {
      counts[n.player_id] = (counts[n.player_id] ?? 0) + 1;
    });
    setNoteCounts(counts);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canViewKarte(role)) router.replace("/schedule");
  }, [role, router]);

  const activeList = players.filter((p) => p.status !== "OB・OG");
  const obogList = players.filter((p) => p.status === "OB・OG");

  return (
    <PageShell
      header={<AppHeader title="選手メモ" variant="detail" backHref="/karte/players" accessBadge="coach" />}
    >
      <Card>
        {loading ? (
          <EmptyState>読み込み中…</EmptyState>
        ) : activeList.length === 0 ? (
          <EmptyState>選手がいません</EmptyState>
        ) : (
          activeList.map((p) => <PlayerNoteRow key={p.id} player={p} noteCount={noteCounts[p.id] ?? 0} />)
        )}
      </Card>

      {!loading && obogList.length > 0 && (
        <>
          <SectionLabel>OB・OG</SectionLabel>
          <Card>
            {obogList.map((p) => (
              <PlayerNoteRow key={p.id} player={p} noteCount={noteCounts[p.id] ?? 0} />
            ))}
          </Card>
        </>
      )}
    </PageShell>
  );
}
