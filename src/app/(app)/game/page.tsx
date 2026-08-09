"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { CurrentUserBadge } from "@/components/CurrentUserBadge";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { canAccessTab } from "@/lib/permissions";
import { formatDateLabel } from "@/lib/format";
import type { Schedule } from "@/lib/database.types";

export default function GameListPage() {
  const router = useRouter();
  const { role } = useSession();
  const [games, setGames] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("schedules")
        .select("*")
        .eq("type", "game")
        .order("date", { ascending: false });
      setGames(data ?? []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!canAccessTab(role, "game")) router.replace("/schedule");
  }, [role, router]);

  return (
    <PageShell header={<AppHeader title="試合記録" rightSlot={<CurrentUserBadge />} />}>
      <SectionLabel>試合を選ぶ</SectionLabel>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : games.length === 0 ? (
        <EmptyState>試合の予定がありません</EmptyState>
      ) : (
        games.map((g) => (
          <Link key={g.id} href={`/game/${g.id}`}>
            <Card className="cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-[14.5px]">{g.title}</div>
                  <div className="text-xs text-ink-soft mt-0.5">
                    {formatDateLabel(g.date)}
                    {g.place ? ` @ ${g.place}` : ""}
                  </div>
                </div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
              </div>
            </Card>
          </Link>
        ))
      )}
    </PageShell>
  );
}
