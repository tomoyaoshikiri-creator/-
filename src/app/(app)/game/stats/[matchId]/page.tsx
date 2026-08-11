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
import { StatPad, type StatEntrant } from "../../StatPad";
import { GameStatLog, type StatLogEntry } from "../../GameStatLog";
import { LineupSection } from "../../LineupSection";
import { OpponentRoster } from "../../OpponentRoster";
import { canRecordGames } from "@/lib/permissions";
import { playerFullName, sortPlayers } from "@/lib/format";
import {
  emptyStatLine,
  emptyOpponentStatLine,
  applyStatEventLocally,
  isStatEventAllowed,
  recordGameStat,
  recordOpponentGameStat,
  deleteGameStatEvent,
  deleteOpponentGameStatEvent,
  statEventPoints,
  type StatEvent,
} from "@/lib/gameStats";
import type {
  AttendanceStatus,
  GameMatch,
  GameOpponentPlayer,
  GameOpponentStatEvent,
  GameOpponentStatLine,
  GamePlayerStatLine,
  GameStatEvent,
  Player,
  Schedule,
} from "@/lib/database.types";

export default function GameStatsPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId;
  const router = useRouter();
  const { teamId, role } = useSession();
  const toast = useToast();
  const [match, setMatch] = useState<GameMatch | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, AttendanceStatus>>({});
  const [quarter, setQuarter] = useState(1);
  const [onCourtIds, setOnCourtIds] = useState<string[]>([]);
  const [statLines, setStatLines] = useState<Record<string, GamePlayerStatLine>>({});
  const [statEvents, setStatEvents] = useState<GameStatEvent[]>([]);
  const [opponentPlayers, setOpponentPlayers] = useState<GameOpponentPlayer[]>([]);
  const [opponentStatLines, setOpponentStatLines] = useState<Record<string, GameOpponentStatLine>>({});
  const [opponentStatEvents, setOpponentStatEvents] = useState<GameOpponentStatEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: m } = await supabase.from("game_matches").select("*").eq("id", matchId).single();
      setMatch(m ?? null);
      if (m) {
        const [{ data: s }, { data: p }, { data: att }, { data: op }] = await Promise.all([
          supabase.from("schedules").select("*").eq("id", m.schedule_id).single(),
          supabase.from("players").select("*"),
          supabase
            .from("attendances")
            .select("player_id, status")
            .eq("schedule_id", m.schedule_id)
            .not("player_id", "is", null),
          supabase.from("game_opponent_players").select("*").eq("match_id", matchId).order("number", { ascending: true }),
        ]);
        setSchedule(s ?? null);
        setPlayers(sortPlayers((p ?? []).filter((x) => x.status === "在籍")));
        const map: Record<string, AttendanceStatus> = {};
        (att ?? []).forEach((a) => {
          if (a.player_id) map[a.player_id] = a.status;
        });
        setAttendanceStatus(map);
        setOpponentPlayers(op ?? []);
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

  const loadOpponentStatLines = useCallback(async () => {
    if (!matchId) return;
    const supabase = createClient();
    const { data } = await supabase.from("game_opponent_stat_lines").select("*").eq("match_id", matchId);
    const map: Record<string, GameOpponentStatLine> = {};
    (data ?? []).forEach((row) => {
      map[row.opponent_player_id] = row;
    });
    setOpponentStatLines(map);
  }, [matchId]);

  const loadOpponentStatEvents = useCallback(async () => {
    if (!matchId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("game_opponent_stat_events")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: false })
      .limit(50);
    setOpponentStatEvents(data ?? []);
  }, [matchId]);

  useEffect(() => {
    loadStatLines();
    loadStatEvents();
    loadOpponentStatLines();
    loadOpponentStatEvents();
  }, [loadStatLines, loadStatEvents, loadOpponentStatLines, loadOpponentStatEvents]);

  useEffect(() => {
    if (!canRecordGames(role)) router.replace("/game/results");
  }, [role, router]);

  function adjustTeamScore(pointsDelta: number) {
    if (pointsDelta === 0) return;
    setMatch((prev) => (prev ? { ...prev, team_score: Math.max(0, (prev.team_score ?? 0) + pointsDelta) } : prev));
  }

  function adjustOpponentScore(pointsDelta: number) {
    if (pointsDelta === 0) return;
    setMatch((prev) =>
      prev ? { ...prev, opponent_score: Math.max(0, (prev.opponent_score ?? 0) + pointsDelta) } : prev,
    );
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
      { id: crypto.randomUUID(), team_id: teamId, match_id: matchId, player_id: playerId, quarter, event, delta, created_at: new Date().toISOString() },
      ...prev,
    ]);
  }

  async function handleOpponentStatTap(opponentPlayerId: string, event: StatEvent, delta: number) {
    if (!matchId) return;
    const prevRow = opponentStatLines[opponentPlayerId] ?? emptyOpponentStatLine(teamId, matchId, opponentPlayerId);
    if (!isStatEventAllowed(prevRow, event, delta)) return;
    const nextRow = applyStatEventLocally(prevRow, event, delta);
    setOpponentStatLines((prev) => ({ ...prev, [opponentPlayerId]: nextRow }));
    const pointsDelta = statEventPoints(event, delta);
    adjustOpponentScore(pointsDelta);
    const supabase = createClient();
    const { data, error } = await recordOpponentGameStat(supabase, matchId, opponentPlayerId, quarter, event, delta);
    if (error) {
      toast(`スタッツの記録に失敗しました: ${error.message}`);
      setOpponentStatLines((prev) => ({ ...prev, [opponentPlayerId]: prevRow }));
      adjustOpponentScore(-pointsDelta);
      return;
    }
    if (data) {
      setOpponentStatLines((prev) => ({ ...prev, [opponentPlayerId]: data }));
    }
    setOpponentStatEvents((prev) => [
      {
        id: crypto.randomUUID(),
        team_id: teamId,
        match_id: matchId,
        opponent_player_id: opponentPlayerId,
        quarter,
        event,
        delta,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  async function handleChangeStatEventQuarter(eventId: string, newQuarter: number) {
    const supabase = createClient();
    const { error } = await supabase.from("game_stat_events").update({ quarter: newQuarter }).eq("id", eventId);
    if (error) {
      toast(`修正に失敗しました: ${error.message}`);
      return;
    }
    setStatEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, quarter: newQuarter } : e)));
    toast("クォーターを修正しました");
  }

  async function handleDeleteStatEvent(eventId: string) {
    const target = statEvents.find((e) => e.id === eventId);
    if (!target) return;
    const supabase = createClient();
    const { error } = await deleteGameStatEvent(supabase, eventId);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    setStatEvents((prev) => prev.filter((e) => e.id !== eventId));
    setStatLines((prev) => {
      const row = prev[target.player_id];
      if (!row) return prev;
      return { ...prev, [target.player_id]: applyStatEventLocally(row, target.event, -target.delta) };
    });
    adjustTeamScore(-statEventPoints(target.event, target.delta));
    toast("記録を削除しました");
  }

  async function handleChangeOpponentStatEventQuarter(eventId: string, newQuarter: number) {
    const supabase = createClient();
    const { error } = await supabase.from("game_opponent_stat_events").update({ quarter: newQuarter }).eq("id", eventId);
    if (error) {
      toast(`修正に失敗しました: ${error.message}`);
      return;
    }
    setOpponentStatEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, quarter: newQuarter } : e)));
    toast("クォーターを修正しました");
  }

  async function handleDeleteOpponentStatEvent(eventId: string) {
    const target = opponentStatEvents.find((e) => e.id === eventId);
    if (!target) return;
    const supabase = createClient();
    const { error } = await deleteOpponentGameStatEvent(supabase, eventId);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    setOpponentStatEvents((prev) => prev.filter((e) => e.id !== eventId));
    setOpponentStatLines((prev) => {
      const row = prev[target.opponent_player_id];
      if (!row) return prev;
      return { ...prev, [target.opponent_player_id]: applyStatEventLocally(row, target.event, -target.delta) };
    });
    adjustOpponentScore(-statEventPoints(target.event, target.delta));
    toast("記録を削除しました");
  }

  const onCourtPlayers = players.filter((p) => onCourtIds.includes(p.id));
  const ownEntrants: StatEntrant[] = onCourtPlayers.map((p) => ({
    id: p.id,
    number: p.number,
    name: playerFullName(p),
  }));
  const opponentEntrants: StatEntrant[] = opponentPlayers.map((p) => ({ id: p.id, number: p.number, name: null }));

  const ownLog: StatLogEntry[] = statEvents.map((e) => {
    const p = players.find((pl) => pl.id === e.player_id);
    return {
      id: e.id,
      quarter: e.quarter,
      entrantLabel: p ? `#${p.number ?? "-"} ${playerFullName(p)}` : "-",
      event: e.event,
      delta: e.delta,
    };
  });
  const opponentLog: StatLogEntry[] = opponentStatEvents.map((e) => {
    const p = opponentPlayers.find((op) => op.id === e.opponent_player_id);
    return {
      id: e.id,
      quarter: e.quarter,
      entrantLabel: p ? `#${p.number}` : "-",
      event: e.event,
      delta: e.delta,
    };
  });

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

          <LineupSection
            matchId={matchId}
            teamId={teamId}
            quarter={quarter}
            players={players}
            attendanceStatus={attendanceStatus}
            onChange={setOnCourtIds}
          />

          <div className="mt-4">
            <SectionLabel>自チームのスタッツ</SectionLabel>
            <StatPad
              entrants={ownEntrants}
              statLines={statLines}
              onTap={handleStatTap}
              emptyMessage="この試合のスタメン・途中出場を登録してください"
            />
          </div>
          <GameStatLog
            title="自チームの記録ログ"
            events={ownLog}
            onChangeQuarter={handleChangeStatEventQuarter}
            onDelete={handleDeleteStatEvent}
          />

          <OpponentRoster
            matchId={matchId}
            teamId={teamId}
            opponentPlayers={opponentPlayers}
            onChange={setOpponentPlayers}
          />

          <div className="mt-4">
            <SectionLabel>相手チームのスタッツ</SectionLabel>
            <StatPad
              entrants={opponentEntrants}
              statLines={opponentStatLines}
              onTap={handleOpponentStatTap}
              emptyMessage="相手選手の背番号を登録してください"
            />
          </div>
          <GameStatLog
            title="相手チームの記録ログ"
            events={opponentLog}
            onChangeQuarter={handleChangeOpponentStatEventQuarter}
            onDelete={handleDeleteOpponentStatEvent}
          />
        </>
      )}
    </PageShell>
  );
}
