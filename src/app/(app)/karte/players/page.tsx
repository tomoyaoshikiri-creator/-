"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState } from "@/components/ui/Card";
import { NumChip } from "@/components/ui/Pill";
import { ChevronRightIcon } from "@/components/icons";
import { canViewKarte } from "@/lib/permissions";
import { playerFullName, sortPlayers } from "@/lib/format";
import type { Player } from "@/lib/database.types";

function PlayerRow({ player }: { player: Player }) {
  return (
    <Link
      href={`/karte/players/${player.id}`}
      className="flex items-center gap-2.5 py-2.5 border-b border-line last:border-b-0"
    >
      <NumChip num={player.number ?? "-"} />
      <div className="flex-1 min-w-0 font-bold text-[13.5px]">{playerFullName(player)}</div>
      <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
    </Link>
  );
}

export default function KartePlayersPage() {
  const router = useRouter();
  const { role } = useSession();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("players").select("*");
      setPlayers(sortPlayers(data ?? []));
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!canViewKarte(role)) router.replace("/schedule");
  }, [role, router]);

  const activeList = players.filter((p) => p.status !== "OB・OG");
  const obogList = players.filter((p) => p.status === "OB・OG");

  return (
    <PageShell
      header={<AppHeader title="選手カルテ" variant="detail" backHref="/karte" accessBadge="coach" />}
    >
      <Card>
        {loading ? (
          <EmptyState>読み込み中…</EmptyState>
        ) : activeList.length === 0 ? (
          <EmptyState>選手がいません</EmptyState>
        ) : (
          activeList.map((p) => <PlayerRow key={p.id} player={p} />)
        )}
      </Card>

      {!loading && obogList.length > 0 && (
        <Link href="/karte/players/obog">
          <Card className="cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="font-bold text-[13.5px]">OB・OG({obogList.length}名)</div>
              <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
            </div>
          </Card>
        </Link>
      )}
    </PageShell>
  );
}
