"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { canAccessTab } from "@/lib/permissions";
import { formatDateLabel } from "@/lib/format";
import type { GameMatch } from "@/lib/database.types";

interface MatchWithDate extends GameMatch {
  schedules: { date: string } | null;
}

export default function GameResultsPage() {
  const router = useRouter();
  const { role } = useSession();
  const [matches, setMatches] = useState<MatchWithDate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("game_matches")
        .select("*, schedules(date)")
        .not("team_score", "is", null)
        .not("opponent_score", "is", null)
        .returns<MatchWithDate[]>();
      const sorted = (data ?? []).slice().sort((a, b) => (b.schedules?.date ?? "").localeCompare(a.schedules?.date ?? ""));
      setMatches(sorted);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!canAccessTab(role, "game")) router.replace("/schedule");
  }, [role, router]);

  const winCount = matches.filter((m) => (m.team_score ?? 0) > (m.opponent_score ?? 0)).length;
  const loseCount = matches.filter((m) => (m.team_score ?? 0) < (m.opponent_score ?? 0)).length;
  const winRateLabel = winCount + loseCount > 0 ? `${((winCount / (winCount + loseCount)) * 100).toFixed(1)}%` : "-";

  return (
    <PageShell header={<AppHeader title="試合結果一覧" variant="detail" backHref="/game" />}>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : matches.length === 0 ? (
        <EmptyState>結果が登録された試合がありません</EmptyState>
      ) : (
        <>
          <Card>
            <div className="flex justify-around text-center">
              <div>
                <div className="text-[20px] font-extrabold" style={{ color: "var(--green)" }}>
                  {winCount}
                </div>
                <div className="text-[10.5px] text-ink-soft mt-0.5">勝ち</div>
              </div>
              <div>
                <div className="text-[20px] font-extrabold" style={{ color: "var(--danger)" }}>
                  {loseCount}
                </div>
                <div className="text-[10.5px] text-ink-soft mt-0.5">負け</div>
              </div>
              <div>
                <div className="text-[20px] font-extrabold text-navy">{winRateLabel}</div>
                <div className="text-[10.5px] text-ink-soft mt-0.5">勝率</div>
              </div>
            </div>
          </Card>

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
                <div className="font-mono text-[11px] text-ink-soft flex-shrink-0">
                  {teamScore}-{opponentScore}
                </div>
                <Pill tone={result === "勝ち" ? "ok" : result === "負け" ? "absent" : "pending"}>{result}</Pill>
                {m.video_url ? (
                  <a
                    href={m.video_url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="動画を見る"
                    className="flex-shrink-0 text-[14px]"
                  >
                    🎥
                  </a>
                ) : (
                  <span className="flex-shrink-0 w-[14px]" />
                )}
              </div>
            );
          })}
        </>
      )}
    </PageShell>
  );
}
