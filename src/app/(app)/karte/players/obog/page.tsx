"use client";

import { useEffect, useState } from "react";
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
import { obogCohortLabel, playerFullName, sortPlayers } from "@/lib/format";
import type { Player } from "@/lib/database.types";

export default function KarteObogPage() {
  const router = useRouter();
  const { role } = useSession();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

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

  const groups = new Map<string, Player[]>();
  for (const p of players) {
    const key = p.grade ?? "unknown";
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (isNaN(na)) return 1;
    if (isNaN(nb)) return -1;
    return na - nb;
  });

  return (
    <PageShell header={<AppHeader title="OB・OG" variant="detail" backHref="/karte/players" accessBadge="coach" />}>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : players.length === 0 ? (
        <EmptyState>OB・OGはいません</EmptyState>
      ) : (
        sortedKeys.map((key) => (
          <div key={key}>
            <SectionLabel>{obogCohortLabel(key === "unknown" ? null : key)}</SectionLabel>
            <Card>
              {groups.get(key)!.map((p) => (
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
              ))}
            </Card>
          </div>
        ))
      )}
    </PageShell>
  );
}
