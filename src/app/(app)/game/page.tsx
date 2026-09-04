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
import { hasCachedValue, useCachedState } from "@/lib/pageCache";
import { canManageStatCategories, canRecordGames } from "@/lib/permissions";
import { usesDetailedBasketballStats } from "@/lib/sport";
import { effectiveFiscalYear, fiscalYearLabel, fiscalYearOf, formatDateLabel, todayDateStr } from "@/lib/format";
import type { GameCategory, Schedule } from "@/lib/database.types";

const CATEGORY_TABS: { label: string; value: GameCategory | "all" }[] = [
  { label: "すべて", value: "all" },
  { label: "練習試合", value: "練習試合" },
  { label: "公式戦", value: "公式戦" },
];

export default function GameListPage() {
  const router = useRouter();
  const { role, sport } = useSession();
  const showStatCategoriesLink = !usesDetailedBasketballStats(sport) && canManageStatCategories(role);
  const [games, setGames] = useCachedState<Schedule[]>("game:games", []);
  const [category, setCategory] = useState<GameCategory | "all">("all");
  const [fiscalYear, setFiscalYear] = useState<number | "all">(fiscalYearOf(todayDateStr()));
  const [loading, setLoading] = useState(() => !hasCachedValue("game:games"));

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
  }, [setGames]);

  useEffect(() => {
    if (!canRecordGames(role)) router.replace("/game/results");
  }, [role, router]);

  // 現年度は試合がまだ無くても選択肢に含める(デフォルト選択がプルダウンの
  // 実在しない値にならないようにするため)。
  const availableYears = Array.from(
    new Set([fiscalYearOf(todayDateStr()), ...games.map((g) => effectiveFiscalYear(g.date, g.fiscal_year_override))]),
  ).sort((a, b) => b - a);

  const filteredGames = games.filter((g) => {
    if (category !== "all" && g.game_category !== category) return false;
    if (fiscalYear !== "all" && effectiveFiscalYear(g.date, g.fiscal_year_override) !== fiscalYear) return false;
    return true;
  });

  return (
    <PageShell header={<AppHeader title="試合記録" accessBadge="coach" />}>
      <Link
        href="/game/results"
        className="flex items-center justify-center gap-1 mb-3.5 py-2.5 rounded-lg border border-orange text-[12.5px] font-bold text-orange bg-orange/8"
      >
        試合結果一覧を見る
        <ChevronRightIcon className="w-3 h-3" />
      </Link>

      {showStatCategoriesLink && (
        <Link
          href="/game/stat-categories"
          className="flex items-center justify-center gap-1 mb-3.5 py-2.5 rounded-lg border border-line text-[12.5px] font-bold text-ink-soft bg-white"
        >
          スタッツ項目を編集
          <ChevronRightIcon className="w-3 h-3" />
        </Link>
      )}

      <div className="flex gap-2 mb-3.5">
        {CATEGORY_TABS.map((t) => (
          <SegButton key={t.value} active={category === t.value} onClick={() => setCategory(t.value)}>
            {t.label}
          </SegButton>
        ))}
      </div>

      {availableYears.length > 0 && (
        <div className="relative inline-block mb-3.5">
          <select
            className="appearance-none bg-white border border-line rounded-lg pl-3 pr-8 py-1.5 text-[12.5px] font-bold text-ink"
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
              {/* --paperがスキン統一(色調整)で白(bg-white、Cardのデフォルト背景)とほぼ
                  見分けが付かない値になり、済んだ試合の色分けが実質見えなくなっていたため、
                  はっきり差が出る--lineに変更した。 */}
              <Card className="cursor-pointer" style={isPast ? { backgroundColor: "var(--line)" } : undefined}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[14.5px]">
                      {g.game_category && (
                        <span className="font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-lg mr-1.5 bg-danger/10 text-danger">
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
