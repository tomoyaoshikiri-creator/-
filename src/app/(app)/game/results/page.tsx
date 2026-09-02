"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { EmptyState, SectionLabel } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { SegButton } from "@/components/ui/SegButton";
import { ChevronRightIcon, VideoIcon } from "@/components/icons";
import { canAccessTab, canRecordGames } from "@/lib/permissions";
import { FREE_GAME_RESULT_LIMIT, hasFullGameHistoryAccess } from "@/lib/plan";
import { formatDateLabel, effectiveFiscalYear, fiscalYearLabel } from "@/lib/format";
import type { GameCategory, GameMatch } from "@/lib/database.types";

interface MatchWithDate extends GameMatch {
  schedules: { date: string; game_category: GameCategory | null; fiscal_year_override: number | null } | null;
}

const CATEGORY_TABS: { label: string; value: GameCategory | "all" }[] = [
  { label: "すべて", value: "all" },
  { label: "練習試合", value: "練習試合" },
  { label: "公式戦", value: "公式戦" },
];

export default function GameResultsPage() {
  const router = useRouter();
  const { role, plan } = useSession();
  const hasFullHistory = hasFullGameHistoryAccess(plan);
  const [allMatches, setAllMatches] = useState<MatchWithDate[]>([]);
  const [category, setCategory] = useState<GameCategory | "all">("all");
  const [fiscalYear, setFiscalYear] = useState<number | "all">("all");
  const [yearInitialized, setYearInitialized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("game_matches")
        .select("*, schedules(date, game_category, fiscal_year_override)")
        .not("team_score", "is", null)
        .not("opponent_score", "is", null)
        .returns<MatchWithDate[]>();
      const sorted = (data ?? []).slice().sort((a, b) => {
        const dateDiff = (b.schedules?.date ?? "").localeCompare(a.schedules?.date ?? "");
        if (dateDiff !== 0) return dateDiff;
        return b.game_number - a.game_number;
      });
      // お試しプランは直近5試合分のみ閲覧可能(データ自体は削除しない)。
      setAllMatches(hasFullHistory ? sorted : sorted.slice(0, FREE_GAME_RESULT_LIMIT));
      setLoading(false);
      if (!yearInitialized && sorted.length > 0 && sorted[0].schedules?.date) {
        setFiscalYear(effectiveFiscalYear(sorted[0].schedules.date, sorted[0].schedules.fiscal_year_override));
        setYearInitialized(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!canAccessTab(role, "game")) router.replace("/home");
  }, [role, router]);

  const availableYears = Array.from(
    new Set(
      allMatches
        .filter((m) => m.schedules?.date)
        .map((m) => effectiveFiscalYear(m.schedules!.date, m.schedules!.fiscal_year_override)),
    ),
  ).sort((a, b) => b - a);

  const matches = allMatches.filter((m) => {
    if (category !== "all" && m.schedules?.game_category !== category) return false;
    if (
      fiscalYear !== "all" &&
      (!m.schedules?.date || effectiveFiscalYear(m.schedules.date, m.schedules.fiscal_year_override) !== fiscalYear)
    )
      return false;
    return true;
  });

  const winCount = matches.filter((m) => (m.team_score ?? 0) > (m.opponent_score ?? 0)).length;
  const loseCount = matches.filter((m) => (m.team_score ?? 0) < (m.opponent_score ?? 0)).length;
  const drawCount = matches.length - winCount - loseCount;
  const winRateLabel = winCount + loseCount > 0 ? `${((winCount / (winCount + loseCount)) * 100).toFixed(1)}%` : "-";

  return (
    <PageShell
      header={
        <AppHeader
          title="試合結果一覧"
          variant={canRecordGames(role) ? "detail" : "list"}
          backHref={canRecordGames(role) ? "/game" : undefined}
        />
      }
    >
      <div className="flex gap-2 mb-2">
        {CATEGORY_TABS.map((t) => (
          <SegButton key={t.value} active={category === t.value} onClick={() => setCategory(t.value)}>
            {t.label}
          </SegButton>
        ))}
      </div>

      {!hasFullHistory && (
        <div className="text-[11px] text-ink-soft bg-paper border border-line rounded-[10px] px-3 py-2 mb-3">
          お試しプランでは直近{FREE_GAME_RESULT_LIMIT}試合分のみ閲覧できます。中間プラン以上で全試合が見られるようになります。
        </div>
      )}

      {availableYears.length > 0 && (
        <div className="relative inline-block mb-3.5">
          <select
            className="appearance-none bg-white border border-line rounded-[10px] pl-3 pr-8 py-1.5 text-[12.5px] font-bold text-ink"
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

      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : matches.length === 0 ? (
        <EmptyState>結果が登録された試合がありません</EmptyState>
      ) : (
        <>
          <div className="bg-white border border-line rounded-2xl px-4 py-2.5 mb-2.5 text-center">
            <div className="font-extrabold text-[22px] text-heading">
              {matches.length}戦{" "}
              <span style={{ color: "var(--green)" }}>{winCount}勝</span>{" "}
              <span style={{ color: "var(--danger)" }}>{loseCount}敗</span>
              {drawCount > 0 && <span className="text-ink-soft"> {drawCount}分</span>}
            </div>
            <div className="text-[13px] font-bold text-ink-soft mt-1">勝率 {winRateLabel}</div>
          </div>

          <SectionLabel>試合ごとの結果</SectionLabel>
          {matches.map((m) => {
            const teamScore = m.team_score ?? 0;
            const opponentScore = m.opponent_score ?? 0;
            const diff = teamScore - opponentScore;
            const result = diff > 0 ? "勝ち" : diff < 0 ? "負け" : "引き分け";
            return (
              <div
                key={m.id}
                className="bg-white border border-line rounded-2xl px-3.5 py-2 mb-2 flex items-center gap-2"
              >
                <div className="text-[10.5px] text-ink-soft flex-shrink-0 w-[46px]">
                  {m.schedules?.date ? formatDateLabel(m.schedules.date) : "-"}
                </div>
                {category === "all" && m.schedules?.game_category && (
                  <span
                    className={`font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                      m.schedules.game_category === "公式戦" ? "bg-danger/10 text-danger" : "bg-sky/10 text-sky"
                    }`}
                  >
                    {m.schedules.game_category}
                  </span>
                )}
                <div className="font-bold text-[12.5px] flex-1 min-w-0 truncate">
                  {m.opponent || "(対戦相手未設定)"}
                </div>
                <div className="font-mono font-bold text-[13px] text-ink flex-shrink-0 mx-1">
                  {teamScore}-{opponentScore}
                </div>
                <Pill tone={result === "勝ち" ? "ok" : result === "負け" ? "absent" : "pending"}>{result}</Pill>
                {m.video_url ? (
                  <a href={m.video_url} target="_blank" rel="noreferrer" aria-label="動画を見る" className="flex-shrink-0">
                    <VideoIcon className="w-[15px] h-[15px] text-orange" />
                  </a>
                ) : (
                  <span className="flex-shrink-0 w-[15px]" />
                )}
              </div>
            );
          })}
        </>
      )}
    </PageShell>
  );
}
