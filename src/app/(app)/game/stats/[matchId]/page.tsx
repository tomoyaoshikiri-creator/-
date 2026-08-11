"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { SegButton, FieldLabel } from "@/components/ui/SegButton";
import { StatPad } from "../../StatPad";
import { GameStatLog } from "../../GameStatLog";
import { canRecordGames } from "@/lib/permissions";
import { sortPlayers } from "@/lib/format";
import {
  emptyStatLine,
  applyStatEventLocally,
  isStatEventAllowed,
  recordGameStat,
  statEventPoints,
  type StatEvent,
} from "@/lib/gameStats";
import type { GameMatch, GamePlayerStatLine, GameStatEvent, Player, Schedule } from "@/lib/database.types";

export default function GameStatsPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId;
  const router = useRouter();
  const { teamId, role } = useSession();
  const toast = useToast();
  const [match, setMatch] = useState<GameMatch | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [quarter, setQuarter] = useState(1);
  const [statLines, setStatLines] = useState<Record<string, GamePlayerStatLine>>({});
  const [statEvents, setStatEvents] = useState<GameStatEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: m } = await supabase.from("game_matches").select("*").eq("id", matchId).single();
      setMatch(m ?? null);
      if (m) {
        const [{ data: s }, { data: p }] = await Promise.all([
          supabase.from("schedules").select("*").eq("id", m.schedule_id).single(),
          supabase.from("players").select("*"),
        ]);
        setSchedule(s ?? null);
        setPlayers(sortPlayers((p ?? []).filter((x) => x.status === "在籍")));
      }
      setLoading(false);
    })();
  }, [matchId]);

  const loadStatLines = useCallback(async () => {
    if (!matchId) return;
    const supabase = createClient();
    const { data } = await supabase.from("game_player_stat_lines").select("*").eq("match_id", matchId);
    const map: Record<string, GamePlayerStatLine> = {};
    (data ?? []).forEach((row) => {
      map[row.player_id] = row;
    });
    setStatLines(map);
  }, [matchId]);

  const loadStatEvents = useCallback(async () => {
    if (!matchId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("game_stat_events")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: false })
      .limit(50);
    setStatEvents(data ?? []);
  }, [matchId]);

  useEffect(() => {
    loadStatLines();
    loadStatEvents();
  }, [loadStatLines, loadStatEvents]);

  useEffect(() => {
    if (!canRecordGames(role)) router.replace("/game/results");
  }, [role, router]);

  function adjustTeamScore(pointsDelta: number) {
    if (pointsDelta === 0) return;
    setMatch((prev) => (prev ? { ...prev, team_score: Math.max(0, (prev.team_score ?? 0) + pointsDelta) } : prev));
  }

  async function handleStatTap(playerId: string, event: StatEvent, delta: number) {
    if (!matchId) return;
    const prevRow = statLines[playerId] ?? emptyStatLine(teamId, matchId, playerId);
    if (!isStatEventAllowed(prevRow, event, delta)) return;
    const nextRow = applyStatEventLocally(prevRow, event, delta);
    setStatLines((prev) => ({ ...prev, [playerId]: nextRow }));
    const pointsDelta = statEventPoints(event, delta);
    adjustTeamScore(pointsDelta);
    const supabase = createClient();
    const { data, error } = await recordGameStat(supabase, matchId, playerId, quarter, event, delta);
    if (error) {
      toast(`スタッツの記録に失敗しました: ${error.message}`);
      setStatLines((prev) => ({ ...prev, [playerId]: prevRow }));
      adjustTeamScore(-pointsDelta);
      return;
    }
    if (data) {
      setStatLines((prev) => ({ ...prev, [playerId]: data }));
    }
    setStatEvents((prev) => [
      {
        id: crypto.randomUUID(),
        team_id: teamId,
        match_id: matchId,
        player_id: playerId,
        quarter,
        event,
        delta,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  return (
    <PageShell
      header={
        <AppHeader
          title="スタッツ入力"
          variant="detail"
          backHref={schedule ? `/game/${schedule.id}` : "/game"}
          accessBadge="coach"
        />
      }
    >
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : !match ? (
        <EmptyState>試合が見つかりません</EmptyState>
      ) : (
        <>
          <Card>
            <div className="font-bold text-[14.5px] text-center">
              第{match.game_number}試合{match.opponent ? ` vs ${match.opponent}` : ""}
            </div>
            <div className="flex items-center justify-center gap-8 mt-2">
              <div className="text-center">
                <div className="text-[11px] font-bold text-ink-soft">{schedule?.title ?? "自チーム"}</div>
                <div className="font-mono text-[32px] font-bold text-orange leading-tight">{match.team_score ?? 0}</div>
              </div>
              <div className="text-ink-soft font-bold text-[18px]">-</div>
              <div className="text-center">
                <div className="text-[11px] font-bold text-ink-soft">{match.opponent || "相手"}</div>
                <div className="font-mono text-[32px] font-bold leading-tight">{match.opponent_score ?? 0}</div>
              </div>
            </div>
          </Card>

          <div className="mt-3">
            <FieldLabel>クォーター</FieldLabel>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map((q) => (
                <SegButton key={q} active={quarter === q} onClick={() => setQuarter(q)}>
                  {q}Q
                </SegButton>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <SectionLabel>スタッツ入力</SectionLabel>
            <StatPad players={players} statLines={statLines} onTap={handleStatTap} />
          </div>

          <GameStatLog events={statEvents} players={players} />
        </>
      )}
    </PageShell>
  );
}
