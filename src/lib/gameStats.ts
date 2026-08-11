import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, GamePlayerStatLine } from "./database.types";

export type StatEvent =
  | "fg_make"
  | "fg_miss"
  | "ft_make"
  | "ft_miss"
  | "reb_off"
  | "reb_def"
  | "ast"
  | "stl"
  | "blk"
  | "tov"
  | "fouls";

export const STAT_BUTTONS: { event: StatEvent; label: string }[] = [
  { event: "fg_make", label: "FG成功" },
  { event: "fg_miss", label: "FG失敗" },
  { event: "ft_make", label: "FT成功" },
  { event: "ft_miss", label: "FT失敗" },
  { event: "reb_off", label: "OFFリバウンド" },
  { event: "reb_def", label: "DEFリバウンド" },
  { event: "ast", label: "アシスト" },
  { event: "stl", label: "スティール" },
  { event: "blk", label: "ブロック" },
  { event: "tov", label: "ターンオーバー" },
  { event: "fouls", label: "ファウル" },
];

export function statEventCount(row: GamePlayerStatLine | undefined, event: StatEvent): number {
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

export function fgPct(row: GamePlayerStatLine | undefined): string {
  if (!row || row.fg_att === 0) return "-";
  return `${Math.round((row.fg_made / row.fg_att) * 100)}%`;
}

export function ftPct(row: GamePlayerStatLine | undefined): string {
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

// タップ直後の楽観的更新用。RPC(record_game_stat)と同じ計算をクライアント側でも再現する。
export function applyStatEventLocally(
  row: GamePlayerStatLine,
  event: StatEvent,
  delta: number,
): GamePlayerStatLine {
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

export function isStatEventAllowed(row: GamePlayerStatLine, event: StatEvent, delta: number): boolean {
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
  event: StatEvent,
  delta: number,
) {
  return supabase.rpc("record_game_stat", {
    p_match_id: matchId,
    p_player_id: playerId,
    p_event: event,
    p_delta: delta,
  });
}
