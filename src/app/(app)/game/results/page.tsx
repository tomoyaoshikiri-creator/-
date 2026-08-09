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
import { VideoIcon } from "@/components/icons";
import { canAccessTab } from "@/lib/permissions";
import { formatDateLabel } from "@/lib/format";
import type { GameCategory, GameMatch } from "@/lib/database.types";

interface MatchWithDate extends GameMatch {
  schedules: { date: string; game_category: GameCategory | null } | null;
}

const CATEGORY_TABS: { label: string; value: GameCategory | "all" }[] = [
  { label: "すべて", value: "all" },
  { label: "練習試合", value: "練習試合" },
  { label: "公式戦", value: "公式戦" },
];

export default function GameResultsPage() {
  const router = useRouter();
  const { role } = useSession();
  const [allMatches, setAllMatches] = useState<MatchWithDate[]>([]);
  const [category, setCategory] = useState<GameCategory | "all">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("game_matches")
        .select("*, schedules(date, game_category)")
        .not("team_score", "is", null)
        .not("opponent_score", "is", null)
        .returns<MatchWithDate[]>();
      const sorted = (data ?? []).slice().sort((a, b) => {
        const dateDiff = (b.schedules?.date ?? "").localeCompare(a.schedules?.date ?? "");
        if (dateDiff !== 0) return dateDiff;
        return b.game_number - a.game_number;
      });
      setAllMatches(sorted);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!canAccessTab(role, "game")) router.replace("/schedule");
  }, [role, router]);

  const matches =
    category === "all" ? allMatches : allMatches.filter((m) => m.schedules?.game_category === category);

  const winCount = matches.filter((m) => (m.team_score ?? 0) > (m.opponent_score ?? 0)).length;
  const loseCount = matches.filter((m) => (m.team_score ?? 0) < (m.opponent_score ?? 0)).length;
  const drawCount = matches.length - winCount - loseCount;
  const winRateLabel = winCount + loseCount > 0 ? `${((winCount / (winCount + loseCount)) * 100).toFixed(1)}%` : "-";

  return (
    <PageShell header={<AppHeader title="試合結果一覧" variant="detail" backHref="/game" />}>
      <div className="flex gap-2 mb-3.5">
        {CATEGORY_TABS.map((t) => (
          <SegButton key={t.value} active={category === t.value} onClick={() => setCategory(t.value)}>
            {t.label}
          </SegButton>
        ))}
      </div>

      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : matches.length === 0 ? (
        <EmptyState>結果が登録された試合がありません</EmptyState>
      ) : (
        <>
          <div className="bg-white border border-line rounded-2xl px-4 py-2.5 mb-2.5 text-center">
            <div className="font-extrabold text-[22px] text-navy">
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
