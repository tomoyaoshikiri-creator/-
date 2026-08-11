"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState } from "@/components/ui/Card";
import { SegButton, FieldLabel } from "@/components/ui/SegButton";
import { StatPad, type StatEntrant } from "../../StatPad";
import { GameStatLog, type StatLogEntry } from "../../GameStatLog";
import { OpponentRoster } from "../../OpponentRoster";
import { StartingLineupModal } from "../../StartingLineupModal";
import { MemberChangeModal, type MemberOption } from "../../MemberChangeModal";
import { canRecordGames } from "@/lib/permissions";
import { playerFullName, sortPlayers, sortOpponentPlayers } from "@/lib/format";
import {
  emptyStatLine,
  emptyOpponentStatLine,
  applyStatEventLocally,
  recordGameStat,
  recordOpponentGameStat,
  deleteGameStatEvent,
  deleteOpponentGameStatEvent,
  resetMatchStats,
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
  const [starters, setStarters] = useState<string[]>([]);
  const [subs, setSubs] = useState<string[]>([]);
  const [benchedStarterIds, setBenchedStarterIds] = useState<string[]>([]);
  const [savingStarters, setSavingStarters] = useState(false);
  const [ownMemberModalOpen, setOwnMemberModalOpen] = useState(false);
  const [startingLineupModalOpen, setStartingLineupModalOpen] = useState(false);
  const [statLines, setStatLines] = useState<Record<string, GamePlayerStatLine>>({});
  const [statEvents, setStatEvents] = useState<GameStatEvent[]>([]);
  const [opponentPlayers, setOpponentPlayers] = useState<GameOpponentPlayer[]>([]);
  const [opponentStarters, setOpponentStarters] = useState<string[]>([]);
  const [opponentSubs, setOpponentSubs] = useState<string[]>([]);
  const [benchedOpponentStarterIds, setBenchedOpponentStarterIds] = useState<string[]>([]);
  const [savingOpponentStarters, setSavingOpponentStarters] = useState(false);
  const [opponentMemberModalOpen, setOpponentMemberModalOpen] = useState(false);
  const [opponentStatLines, setOpponentStatLines] = useState<Record<string, GameOpponentStatLine>>({});
  const [opponentStatEvents, setOpponentStatEvents] = useState<GameOpponentStatEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

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
        setOpponentPlayers(sortOpponentPlayers(op ?? []));
      }
      setLoading(false);
    })();
  }, [matchId]);

  const loadRecord = useCallback(async () => {
    if (!matchId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("game_records")
      .select("*")
      .eq("match_id", matchId)
      .eq("quarter", quarter)
      .maybeSingle();
    setStarters(data?.starter_player_ids ?? []);
    setSubs(data?.sub_player_ids ?? []);
    setBenchedStarterIds([]);
  }, [matchId, quarter]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  const loadOpponentRecord = useCallback(async () => {
    if (!matchId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("game_opponent_records")
      .select("*")
      .eq("match_id", matchId)
      .eq("quarter", quarter)
      .maybeSingle();
    setOpponentStarters(data?.starter_opponent_player_ids ?? []);
    setOpponentSubs(data?.sub_opponent_player_ids ?? []);
    setBenchedOpponentStarterIds([]);
  }, [matchId, quarter]);

  useEffect(() => {
    loadOpponentRecord();
  }, [loadOpponentRecord]);

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

  async function saveRecord(newStarters: string[], newSubs: string[]) {
    const supabase = createClient();
    const { error } = await supabase.from("game_records").upsert(
      {
        team_id: teamId,
        match_id: matchId,
        quarter,
        starter_player_ids: newStarters,
        sub_player_ids: newSubs,
      },
      { onConflict: "match_id,quarter" },
    );
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return false;
    }
    setStarters(newStarters);
    setSubs(newSubs);
    return true;
  }

  async function handleSaveStarters(newStarters: string[]) {
    setSavingStarters(true);
    const ok = await saveRecord(newStarters, subs);
    setSavingStarters(false);
    if (ok) toast(`${quarter}Qのスターティングを登録しました`);
  }

  async function saveOpponentRecord(newStarters: string[], newSubs: string[]) {
    const supabase = createClient();
    const { error } = await supabase.from("game_opponent_records").upsert(
      {
        team_id: teamId,
        match_id: matchId,
        quarter,
        starter_opponent_player_ids: newStarters,
        sub_opponent_player_ids: newSubs,
      },
      { onConflict: "match_id,quarter" },
    );
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return false;
    }
    setOpponentStarters(newStarters);
    setOpponentSubs(newSubs);
    return true;
  }

  async function handleSaveOpponentStarters(newStarters: string[]) {
    setSavingOpponentStarters(true);
    const ok = await saveOpponentRecord(newStarters, opponentSubs);
    setSavingOpponentStarters(false);
    if (ok) toast(`${quarter}Qの相手スターティングを登録しました`);
  }

  // メンバーチェンジ: 出場中の選手をタップして選択解除→控えの選手をタップして選択、で交代を表す。
  // スタメンは選択解除するとベンチ扱い(benchedStarterIds)にし、記録上のスタメンそのものは変更しない。
  // 出場中は常に5人までとし、既に5人いる状態で新たに選ぼうとした場合は先に誰かを外してもらう。
  async function handleToggleOwnMember(playerId: string) {
    const isOnCourt = onCourtIds.includes(playerId);
    if (!isOnCourt && onCourtIds.length >= 5) {
      return;
    }
    if (starters.includes(playerId)) {
      setBenchedStarterIds((prev) =>
        prev.includes(playerId) ? prev.filter((x) => x !== playerId) : [...prev, playerId],
      );
      return;
    }
    const nextSubs = subs.includes(playerId) ? subs.filter((x) => x !== playerId) : [...subs, playerId];
    await saveRecord(starters, nextSubs);
  }

  async function handleToggleOpponentMember(opponentPlayerId: string) {
    const isOnCourt = opponentOnCourtIds.includes(opponentPlayerId);
    if (!isOnCourt && opponentOnCourtIds.length >= 5) {
      return;
    }
    if (opponentStarters.includes(opponentPlayerId)) {
      setBenchedOpponentStarterIds((prev) =>
        prev.includes(opponentPlayerId) ? prev.filter((x) => x !== opponentPlayerId) : [...prev, opponentPlayerId],
      );
      return;
    }
    const nextSubs = opponentSubs.includes(opponentPlayerId)
      ? opponentSubs.filter((x) => x !== opponentPlayerId)
      : [...opponentSubs, opponentPlayerId];
    await saveOpponentRecord(opponentStarters, nextSubs);
  }

  async function handleStatTap(playerId: string, event: StatEvent) {
    if (!matchId) return;
    const delta = 1;
    const prevRow = statLines[playerId] ?? emptyStatLine(teamId, matchId, playerId);
    const nextRow = applyStatEventLocally(prevRow, event, delta);
    setStatLines((prev) => ({ ...prev, [playerId]: nextRow }));
    const supabase = createClient();
    const { data, error } = await recordGameStat(supabase, matchId, playerId, quarter, event, delta);
    if (error) {
      toast(`スタッツの記録に失敗しました: ${error.message}`);
      setStatLines((prev) => ({ ...prev, [playerId]: prevRow }));
      return;
    }
    const result = data?.[0];
    if (result) {
      setStatLines((prev) => ({ ...prev, [playerId]: result.line }));
      setStatEvents((prev) => [
        {
          id: result.event_id,
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
  }

  async function handleOpponentStatTap(opponentPlayerId: string, event: StatEvent) {
    if (!matchId) return;
    const delta = 1;
    const prevRow = opponentStatLines[opponentPlayerId] ?? emptyOpponentStatLine(teamId, matchId, opponentPlayerId);
    const nextRow = applyStatEventLocally(prevRow, event, delta);
    setOpponentStatLines((prev) => ({ ...prev, [opponentPlayerId]: nextRow }));
    const supabase = createClient();
    const { data, error } = await recordOpponentGameStat(supabase, matchId, opponentPlayerId, quarter, event, delta);
    if (error) {
      toast(`スタッツの記録に失敗しました: ${error.message}`);
      setOpponentStatLines((prev) => ({ ...prev, [opponentPlayerId]: prevRow }));
      return;
    }
    const result = data?.[0];
    if (result) {
      setOpponentStatLines((prev) => ({ ...prev, [opponentPlayerId]: result.line }));
      setOpponentStatEvents((prev) => [
        {
          id: result.event_id,
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
  }

  // フリースローは1本/2本のトリップ単位で結果をまとめて記録する。ローカルの合計は一括で
  // 計算してから、個々のショットを順番にRPCへ送って記録ログに1本ずつ残す。
  async function handleFreeThrowTrip(playerId: string, makes: number, attempts: number) {
    if (!matchId) return;
    const misses = attempts - makes;
    const prevRow = statLines[playerId] ?? emptyStatLine(teamId, matchId, playerId);
    let nextRow = prevRow;
    for (let i = 0; i < makes; i++) nextRow = applyStatEventLocally(nextRow, "ft_make", 1);
    for (let i = 0; i < misses; i++) nextRow = applyStatEventLocally(nextRow, "ft_miss", 1);
    setStatLines((prev) => ({ ...prev, [playerId]: nextRow }));
    const supabase = createClient();
    for (let i = 0; i < makes; i++) {
      const { data, error } = await recordGameStat(supabase, matchId, playerId, quarter, "ft_make", 1);
      if (error) {
        toast(`スタッツの記録に失敗しました: ${error.message}`);
        continue;
      }
      const result = data?.[0];
      if (result) {
        setStatLines((prev) => ({ ...prev, [playerId]: result.line }));
        setStatEvents((prev) => [
          {
            id: result.event_id,
            team_id: teamId,
            match_id: matchId,
            player_id: playerId,
            quarter,
            event: "ft_make",
            delta: 1,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    }
    for (let i = 0; i < misses; i++) {
      const { data, error } = await recordGameStat(supabase, matchId, playerId, quarter, "ft_miss", 1);
      if (error) {
        toast(`スタッツの記録に失敗しました: ${error.message}`);
        continue;
      }
      const result = data?.[0];
      if (result) {
        setStatLines((prev) => ({ ...prev, [playerId]: result.line }));
        setStatEvents((prev) => [
          {
            id: result.event_id,
            team_id: teamId,
            match_id: matchId,
            player_id: playerId,
            quarter,
            event: "ft_miss",
            delta: 1,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    }
  }

  async function handleOpponentFreeThrowTrip(opponentPlayerId: string, makes: number, attempts: number) {
    if (!matchId) return;
    const misses = attempts - makes;
    const prevRow = opponentStatLines[opponentPlayerId] ?? emptyOpponentStatLine(teamId, matchId, opponentPlayerId);
    let nextRow = prevRow;
    for (let i = 0; i < makes; i++) nextRow = applyStatEventLocally(nextRow, "ft_make", 1);
    for (let i = 0; i < misses; i++) nextRow = applyStatEventLocally(nextRow, "ft_miss", 1);
    setOpponentStatLines((prev) => ({ ...prev, [opponentPlayerId]: nextRow }));
    const supabase = createClient();
    for (let i = 0; i < makes; i++) {
      const { data, error } = await recordOpponentGameStat(supabase, matchId, opponentPlayerId, quarter, "ft_make", 1);
      if (error) {
        toast(`スタッツの記録に失敗しました: ${error.message}`);
        continue;
      }
      const result = data?.[0];
      if (result) {
        setOpponentStatLines((prev) => ({ ...prev, [opponentPlayerId]: result.line }));
        setOpponentStatEvents((prev) => [
          {
            id: result.event_id,
            team_id: teamId,
            match_id: matchId,
            opponent_player_id: opponentPlayerId,
            quarter,
            event: "ft_make",
            delta: 1,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    }
    for (let i = 0; i < misses; i++) {
      const { data, error } = await recordOpponentGameStat(supabase, matchId, opponentPlayerId, quarter, "ft_miss", 1);
      if (error) {
        toast(`スタッツの記録に失敗しました: ${error.message}`);
        continue;
      }
      const result = data?.[0];
      if (result) {
        setOpponentStatLines((prev) => ({ ...prev, [opponentPlayerId]: result.line }));
        setOpponentStatEvents((prev) => [
          {
            id: result.event_id,
            team_id: teamId,
            match_id: matchId,
            opponent_player_id: opponentPlayerId,
            quarter,
            event: "ft_miss",
            delta: 1,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    }
  }

  // 「−」タップは新たに取消イベントを積み上げるのではなく、直近の該当タップそのものを削除する。
  async function handleStatUndo(playerId: string, event: StatEvent) {
    const target = statEvents.find((e) => e.player_id === playerId && e.event === event && e.delta > 0);
    if (!target) {
      toast("取り消せる記録が見つかりませんでした");
      return;
    }
    await handleDeleteStatEvent(target.id);
  }

  async function handleOpponentStatUndo(opponentPlayerId: string, event: StatEvent) {
    const target = opponentStatEvents.find(
      (e) => e.opponent_player_id === opponentPlayerId && e.event === event && e.delta > 0,
    );
    if (!target) {
      toast("取り消せる記録が見つかりませんでした");
      return;
    }
    await handleDeleteOpponentStatEvent(target.id);
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
    toast("記録を削除しました");
  }

  async function handleResetStats() {
    if (!resetConfirm) {
      setResetConfirm(true);
      setTimeout(() => setResetConfirm(false), 3000);
      return;
    }
    setResetConfirm(false);
    setResetting(true);
    const supabase = createClient();
    const { error } = await resetMatchStats(supabase, matchId);
    setResetting(false);
    if (error) {
      toast(`リセットに失敗しました: ${error.message}`);
      return;
    }
    setStatLines({});
    setStatEvents([]);
    setOpponentStatLines({});
    setOpponentStatEvents([]);
    setStarters([]);
    setSubs([]);
    setBenchedStarterIds([]);
    setOpponentStarters([]);
    setOpponentSubs([]);
    setBenchedOpponentStarterIds([]);
    setOpponentPlayers([]);
    toast("この試合のスタッツ・スタメン・相手選手の登録をリセットしました");
  }

  const onCourtIds = Array.from(
    new Set([...starters.filter((id) => !benchedStarterIds.includes(id)), ...subs]),
  );
  const onCourtPlayers = players.filter((p) => onCourtIds.includes(p.id));
  const ownEntrants: StatEntrant[] = onCourtPlayers.map((p) => ({
    id: p.id,
    number: p.number,
    name: p.mei,
  }));
  const opponentOnCourtIds = Array.from(
    new Set([...opponentStarters.filter((id) => !benchedOpponentStarterIds.includes(id)), ...opponentSubs]),
  );
  const onCourtOpponents = opponentPlayers.filter((p) => opponentOnCourtIds.includes(p.id));
  const opponentEntrants: StatEntrant[] = onCourtOpponents.map((p) => ({ id: p.id, number: p.number, name: null }));

  const ownMemberOptions: MemberOption[] = players.map((p) => ({
    id: p.id,
    label: `${p.number ? `#${p.number} ` : ""}${playerFullName(p)}`,
    checked: onCourtIds.includes(p.id),
  }));
  const opponentMemberOptions: MemberOption[] = opponentPlayers.map((p) => ({
    id: p.id,
    label: `#${p.number}`,
    checked: opponentOnCourtIds.includes(p.id),
  }));

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

  // スタッツから記録された得点の集計。試合結果一覧などで使う公式スコア(game_matches.team_score/
  // opponent_score)とは別物として扱い、ここでは書き込まない(手入力の得点と混ざって二重計上に
  // ならないようにするため)。公式スコアの編集は試合詳細画面で行う。
  const liveTeamScore = Object.values(statLines).reduce((sum, l) => sum + l.pts, 0);
  const liveOpponentScore = Object.values(opponentStatLines).reduce((sum, l) => sum + l.pts, 0);

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
                <div className="font-mono text-[32px] font-bold text-orange leading-tight">{liveTeamScore}</div>
              </div>
              <div className="text-ink-soft font-bold text-[18px]">-</div>
              <div className="text-center">
                <div className="text-[11px] font-bold text-ink-soft">{match.opponent || "相手"}</div>
                <div className="font-mono text-[32px] font-bold leading-tight">{liveOpponentScore}</div>
              </div>
            </div>
            <div className="text-[10px] text-ink-soft text-center mt-1.5">
              スタッツの記録から集計した得点です。試合結果の得点は試合詳細画面で編集してください
            </div>
          </Card>

          <button
            type="button"
            onClick={handleResetStats}
            disabled={resetting}
            className="w-full text-center py-2 rounded-[10px] font-bold text-[12px] border bg-white"
            style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
          >
            {resetting
              ? "リセット中…"
              : resetConfirm
                ? "もう一度タップでこの試合のスタッツ・スタメンを全てリセット"
                : "この試合のスタッツ・スタメンをオールリセット"}
          </button>

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

          <div className="mt-4">
            <StatPad
              ownEntrants={ownEntrants}
              ownStatLines={statLines}
              onOwnTap={handleStatTap}
              onOwnUndo={handleStatUndo}
              onOwnFreeThrowTrip={handleFreeThrowTrip}
              onOpenOwnMemberChange={() => setOwnMemberModalOpen(true)}
              opponentEntrants={opponentEntrants}
              opponentStatLines={opponentStatLines}
              onOpponentTap={handleOpponentStatTap}
              onOpponentUndo={handleOpponentStatUndo}
              onOpponentFreeThrowTrip={handleOpponentFreeThrowTrip}
              onOpenOpponentMemberChange={() => setOpponentMemberModalOpen(true)}
            />
          </div>

          <OpponentRoster
            matchId={matchId}
            teamId={teamId}
            opponentPlayers={opponentPlayers}
            onChange={(list) => setOpponentPlayers(sortOpponentPlayers(list))}
          />

          <GameStatLog
            title="自チームの記録ログ"
            events={ownLog}
            onChangeQuarter={handleChangeStatEventQuarter}
            onDelete={handleDeleteStatEvent}
          />
          <GameStatLog
            title="相手チームの記録ログ"
            events={opponentLog}
            onChangeQuarter={handleChangeOpponentStatEventQuarter}
            onDelete={handleDeleteOpponentStatEvent}
          />

          <button
            type="button"
            onClick={() => setStartingLineupModalOpen(true)}
            className="w-full mt-4 text-center py-2 rounded-[10px] font-bold text-[12px] border border-line text-ink-soft bg-white"
          >
            スターティングの編集
          </button>

          <MemberChangeModal
            open={ownMemberModalOpen}
            onClose={() => setOwnMemberModalOpen(false)}
            title="メンバーチェンジ"
            options={ownMemberOptions}
            onToggle={handleToggleOwnMember}
          />
          <MemberChangeModal
            open={opponentMemberModalOpen}
            onClose={() => setOpponentMemberModalOpen(false)}
            title="メンバーチェンジ(相手チーム)"
            options={opponentMemberOptions}
            onToggle={handleToggleOpponentMember}
          />
          <StartingLineupModal
            open={startingLineupModalOpen}
            onClose={() => setStartingLineupModalOpen(false)}
            starters={starters}
            savingStarters={savingStarters}
            players={players}
            attendanceStatus={attendanceStatus}
            onSaveStarters={handleSaveStarters}
            opponentPlayers={opponentPlayers}
            opponentStarters={opponentStarters}
            savingOpponentStarters={savingOpponentStarters}
            onSaveOpponentStarters={handleSaveOpponentStarters}
          />
        </>
      )}
    </PageShell>
  );
}
