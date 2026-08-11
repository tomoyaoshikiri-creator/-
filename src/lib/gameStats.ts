import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, GamePlayerStatLine, GameOpponentStatLine, StatEvent } from "./database.types";

export type { StatEvent };

// 自チーム(GamePlayerStatLine)・相手チーム(GameOpponentStatLine)どちらも
// 集計値としてはこの形をしているため、表示・計算ロジックはこの型だけを見て共通化する。
export interface StatTotals {
  fg_made: number;
  fg_att: number;
  ft_made: number;
  ft_att: number;
  pts: number;
  reb_off: number;
  reb_def: number;
  ast: number;
  blk: number;
  stl: number;
  tov: number;
  fouls: number;
  reb: number;
  eff: number;
}

export const STAT_BUTTONS: { event: StatEvent; label: string }[] = [
  { event: "fg_make", label: "シュート成功" },
  { event: "fg_miss", label: "シュート失敗" },
  { event: "ft_make", label: "フリースロー成功" },
  { event: "ft_miss", label: "フリースロー失敗" },
  { event: "ast", label: "アシスト" },
  { event: "fouls", label: "ファウル" },
  { event: "tov", label: "ターンオーバー" },
  { event: "blk", label: "ブロック" },
  { event: "stl", label: "スティール" },
  { event: "reb_off", label: "OFFリバウンド" },
  { event: "reb_def", label: "DEFリバウンド" },
];

export function statEventCount(row: StatTotals | undefined, event: StatEvent): number {
  if (!row) return 0;
  switch (event) {
    case "fg_make":
      return row.fg_made;
    case "fg_miss":
      return row.fg_att - row.fg_made;
    case "ft_make":
      return row.ft_made;
    case "ft_miss":
      return row.ft_att - row.ft_made;
    case "reb_off":
      return row.reb_off;
    case "reb_def":
      return row.reb_def;
    case "ast":
      return row.ast;
    case "stl":
      return row.stl;
    case "blk":
      return row.blk;
    case "tov":
      return row.tov;
    case "fouls":
      return row.fouls;
  }
}

export function fgPct(row: StatTotals | undefined): string {
  if (!row || row.fg_att === 0) return "-";
  return `${Math.round((row.fg_made / row.fg_att) * 100)}%`;
}

export function ftPct(row: StatTotals | undefined): string {
  if (!row || row.ft_att === 0) return "-";
  return `${Math.round((row.ft_made / row.ft_att) * 100)}%`;
}

export function emptyStatLine(teamId: string, matchId: string, playerId: string): GamePlayerStatLine {
  return {
    id: "",
    team_id: teamId,
    match_id: matchId,
    player_id: playerId,
    fg_made: 0,
    fg_att: 0,
    ft_made: 0,
    ft_att: 0,
    pts: 0,
    reb_off: 0,
    reb_def: 0,
    ast: 0,
    blk: 0,
    stl: 0,
    tov: 0,
    fouls: 0,
    reb: 0,
    eff: 0,
    updated_at: new Date().toISOString(),
  };
}

export function emptyOpponentStatLine(teamId: string, matchId: string, opponentPlayerId: string): GameOpponentStatLine {
  return {
    id: "",
    team_id: teamId,
    match_id: matchId,
    opponent_player_id: opponentPlayerId,
    fg_made: 0,
    fg_att: 0,
    ft_made: 0,
    ft_att: 0,
    pts: 0,
    reb_off: 0,
    reb_def: 0,
    ast: 0,
    blk: 0,
    stl: 0,
    tov: 0,
    fouls: 0,
    reb: 0,
    eff: 0,
    updated_at: new Date().toISOString(),
  };
}

// タップ直後の楽観的更新用。RPC(record_game_stat/record_opponent_game_stat)と同じ計算を再現する。
export function applyStatEventLocally<T extends StatTotals>(row: T, event: StatEvent, delta: number): T {
  const next = { ...row };
  switch (event) {
    case "fg_make":
      next.fg_made += delta;
      next.fg_att += delta;
      next.pts += delta * 2;
      break;
    case "fg_miss":
      next.fg_att += delta;
      break;
    case "ft_make":
      next.ft_made += delta;
      next.ft_att += delta;
      next.pts += delta;
      break;
    case "ft_miss":
      next.ft_att += delta;
      break;
    case "reb_off":
      next.reb_off += delta;
      break;
    case "reb_def":
      next.reb_def += delta;
      break;
    case "ast":
      next.ast += delta;
      break;
    case "stl":
      next.stl += delta;
      break;
    case "blk":
      next.blk += delta;
      break;
    case "tov":
      next.tov += delta;
      break;
    case "fouls":
      next.fouls += delta;
      break;
  }
  next.reb = next.reb_off + next.reb_def;
  next.eff =
    next.pts +
    next.reb_off +
    next.reb_def +
    next.ast +
    next.stl +
    next.blk -
    (next.fg_att - next.fg_made) -
    (next.ft_att - next.ft_made) -
    next.tov;
  return next;
}

export function isStatEventAllowed<T extends StatTotals>(row: T, event: StatEvent, delta: number): boolean {
  const next = applyStatEventLocally(row, event, delta);
  return (
    next.fg_made >= 0 &&
    next.fg_att >= next.fg_made &&
    next.ft_made >= 0 &&
    next.ft_att >= next.ft_made &&
    next.reb_off >= 0 &&
    next.reb_def >= 0 &&
    next.ast >= 0 &&
    next.stl >= 0 &&
    next.blk >= 0 &&
    next.tov >= 0 &&
    next.fouls >= 0
  );
}

export function recordGameStat(
  supabase: SupabaseClient<Database>,
  matchId: string,
  playerId: string,
  quarter: number,
  event: StatEvent,
  delta: number,
) {
  return supabase.rpc("record_game_stat", {
    p_match_id: matchId,
    p_player_id: playerId,
    p_quarter: quarter,
    p_event: event,
    p_delta: delta,
  });
}

export function recordOpponentGameStat(
  supabase: SupabaseClient<Database>,
  matchId: string,
  opponentPlayerId: string,
  quarter: number,
  event: StatEvent,
  delta: number,
) {
  return supabase.rpc("record_opponent_game_stat", {
    p_match_id: matchId,
    p_opponent_player_id: opponentPlayerId,
    p_quarter: quarter,
    p_event: event,
    p_delta: delta,
  });
}

export function deleteGameStatEvent(supabase: SupabaseClient<Database>, eventId: string) {
  return supabase.rpc("delete_game_stat_event", { p_event_id: eventId });
}

export function deleteOpponentGameStatEvent(supabase: SupabaseClient<Database>, eventId: string) {
  return supabase.rpc("delete_opponent_game_stat_event", { p_event_id: eventId });
}

export function resetMatchStats(supabase: SupabaseClient<Database>, matchId: string) {
  return supabase.rpc("reset_match_stats", { p_match_id: matchId });
}

export function statEventLabel(event: StatEvent): string {
  return STAT_BUTTONS.find((b) => b.event === event)?.label ?? event;
}

export function statEventPoints(event: StatEvent, delta: number): number {
  if (event === "fg_make") return delta * 2;
  if (event === "ft_make") return delta;
  return 0;
}
