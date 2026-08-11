"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { SegButton } from "@/components/ui/SegButton";
import { ChevronRightIcon } from "@/components/icons";
import { canRecordGames } from "@/lib/permissions";
import { formatDateLabel, todayDateStr } from "@/lib/format";
import type { GameCategory, Schedule } from "@/lib/database.types";

const CATEGORY_TABS: { label: string; value: GameCategory | "all" }[] = [
  { label: "すべて", value: "all" },
  { label: "練習試合", value: "練習試合" },
  { label: "公式戦", value: "公式戦" },
];

export default function GameListPage() {
  const router = useRouter();
  const { role } = useSession();
  const [games, setGames] = useState<Schedule[]>([]);
  const [category, setCategory] = useState<GameCategory | "all">("all");
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
    if (!canRecordGames(role)) router.replace("/game/results");
  }, [role, router]);

  const filteredGames = category === "all" ? games : games.filter((g) => g.game_category === category);

  return (
    <PageShell header={<AppHeader title="試合記録" accessBadge="coach" />}>
      <Link
        href="/game/results"
        className="flex items-center justify-center gap-1 mb-3.5 py-2.5 rounded-[10px] border border-orange text-[12.5px] font-bold text-orange bg-orange/8"
      >
        試合結果一覧を見る
        <ChevronRightIcon className="w-3 h-3" />
      </Link>

      <div className="flex gap-2 mb-3.5">
        {CATEGORY_TABS.map((t) => (
          <SegButton key={t.value} active={category === t.value} onClick={() => setCategory(t.value)}>
            {t.label}
          </SegButton>
        ))}
      </div>

      <SectionLabel>試合を選ぶ</SectionLabel>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : filteredGames.length === 0 ? (
        <EmptyState>試合の予定がありません</EmptyState>
      ) : (
        filteredGames.map((g) => {
          const isPast = g.date < todayDateStr();
          return (
            <Link key={g.id} href={`/game/${g.id}`}>
              <Card className="cursor-pointer" style={isPast ? { backgroundColor: "#e8e6e1" } : undefined}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[14.5px]">
                      {g.game_category && (
                        <span className="font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-md mr-1.5 bg-danger/10 text-danger">
                          {g.game_category}
                        </span>
                      )}
                      {g.title}
                    </div>
                    <div className="text-xs text-ink-soft mt-0.5">
                      {formatDateLabel(g.date)}
                      {g.place ? ` @ ${g.place}` : ""}
                    </div>
                  </div>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
                </div>
              </Card>
            </Link>
          );
        })
      )}
    </PageShell>
  );
}
