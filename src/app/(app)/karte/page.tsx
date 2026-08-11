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
import { gradeLabel, playerFullName, sortPlayers } from "@/lib/format";
import type { Player } from "@/lib/database.types";

export default function KartePage() {
  const router = useRouter();
  const { role } = useSession();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("players").select("*").neq("status", "OB・OG");
      setPlayers(sortPlayers(data ?? []));
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!canViewKarte(role)) router.replace("/schedule");
  }, [role, router]);

  return (
    <PageShell
      header={
        <AppHeader
          title="カルテ"
          rightSlot={
            <Link href="/karte/ranking" className="text-[12.5px] font-bold text-white/90 underline">
              ランキング
            </Link>
          }
          accessBadge="coach"
        />
      }
    >
      <Card>
        {loading ? (
          <EmptyState>読み込み中…</EmptyState>
        ) : players.length === 0 ? (
          <EmptyState>選手がいません</EmptyState>
        ) : (
          players.map((p) => (
            <Link
              key={p.id}
              href={`/karte/${p.id}`}
              className="flex items-center gap-2.5 py-2.5 border-b border-line last:border-b-0"
            >
              <NumChip num={p.number ?? "-"} />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[13.5px]">{playerFullName(p)}</div>
                <div className="text-[11px] text-ink-soft mt-0.5">
                  {gradeLabel(p.grade)}・{p.positions.join("/")}
                </div>
              </div>
              <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
            </Link>
          ))
        )}
      </Card>
    </PageShell>
  );
}
