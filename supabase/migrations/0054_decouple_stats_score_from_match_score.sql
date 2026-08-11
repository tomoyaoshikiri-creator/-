-- 試合結果一覧などで使う公式スコア(game_matches.team_score/opponent_score、試合詳細画面で
-- 手入力)と、スタッツ記録画面が集計するスコアを完全に切り離す。
-- これまではスタッツを1本記録・削除するたびにgame_matches.team_score/opponent_scoreを
-- 書き換えていたため、手入力した公式スコアがスタッツ記録によって上書きされてしまっていた。
-- 今後はrecord_game_stat/record_opponent_game_stat/delete_game_stat_event/
-- delete_opponent_game_stat_eventはgame_player_stat_lines/game_opponent_stat_lines/
-- game_stat_events/game_opponent_stat_eventsだけを更新し、game_matchesには一切触れない。
-- スタッツ画面側の集計スコアはクライアントでgame_player_stat_lines/game_opponent_stat_lines
-- のptsから毎回計算して表示する(このマイグレーションではDB側の変更のみ)。

drop function if exists public.record_game_stat(uuid, uuid, int, text, int);

create function public.record_game_stat(
  p_match_id uuid,
  p_player_id uuid,
  p_quarter int,
  p_event text,
  p_delta int default 1
) returns table (line public.game_player_stat_lines, event_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_row public.game_player_stat_lines;
  v_event_id uuid;
begin
  if public.current_role() not in ('指導者', '管理者') then
    raise exception 'permission denied';
  end if;
  if p_event not in (
    'fg_make', 'fg_miss', 'ft_make', 'ft_miss',
    'reb_off', 'reb_def', 'ast', 'blk', 'stl', 'tov', 'fouls'
  ) then
    raise exception 'unknown event: %', p_event;
  end if;

  select gm.team_id into v_team_id
  from public.game_matches gm
  where gm.id = p_match_id and gm.team_id = public.current_team_id();
  if v_team_id is null then
    raise exception 'match not found';
  end if;

  insert into public.game_player_stat_lines (team_id, match_id, player_id)
  values (v_team_id, p_match_id, p_player_id)
  on conflict (match_id, player_id) do nothing;

  update public.game_player_stat_lines set
    fg_made = fg_made + case when p_event = 'fg_make' then p_delta else 0 end,
    fg_att = fg_att + case when p_event in ('fg_make', 'fg_miss') then p_delta else 0 end,
    ft_made = ft_made + case when p_event = 'ft_make' then p_delta else 0 end,
    ft_att = ft_att + case when p_event in ('ft_make', 'ft_miss') then p_delta else 0 end,
    pts = pts + case when p_event = 'fg_make' then p_delta * 2 when p_event = 'ft_make' then p_delta else 0 end,
    reb_off = reb_off + case when p_event = 'reb_off' then p_delta else 0 end,
    reb_def = reb_def + case when p_event = 'reb_def' then p_delta else 0 end,
    ast = ast + case when p_event = 'ast' then p_delta else 0 end,
    blk = blk + case when p_event = 'blk' then p_delta else 0 end,
    stl = stl + case when p_event = 'stl' then p_delta else 0 end,
    tov = tov + case when p_event = 'tov' then p_delta else 0 end,
    fouls = fouls + case when p_event = 'fouls' then p_delta else 0 end,
    updated_at = now()
  where match_id = p_match_id and player_id = p_player_id
  returning * into v_row;

  if v_row.fg_made < 0 or v_row.fg_att < v_row.fg_made
     or v_row.ft_made < 0 or v_row.ft_att < v_row.ft_made
     or v_row.reb_off < 0 or v_row.reb_def < 0 or v_row.ast < 0 or v_row.blk < 0
     or v_row.stl < 0 or v_row.tov < 0 or v_row.fouls < 0 then
    raise exception 'stat cannot go below zero';
  end if;

  insert into public.game_stat_events (team_id, match_id, player_id, quarter, event, delta)
  values (v_team_id, p_match_id, p_player_id, p_quarter, p_event, p_delta)
  returning id into v_event_id;

  return query select v_row, v_event_id;
end;
$$;

grant execute on function public.record_game_stat(uuid, uuid, int, text, int) to authenticated;

drop function if exists public.record_opponent_game_stat(uuid, uuid, int, text, int);

create function public.record_opponent_game_stat(
  p_match_id uuid,
  p_opponent_player_id uuid,
  p_quarter int,
  p_event text,
  p_delta int default 1
) returns table (line public.game_opponent_stat_lines, event_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_row public.game_opponent_stat_lines;
  v_event_id uuid;
begin
  if public.current_role() not in ('指導者', '管理者') then
    raise exception 'permission denied';
  end if;
  if p_event not in (
    'fg_make', 'fg_miss', 'ft_make', 'ft_miss',
    'reb_off', 'reb_def', 'ast', 'blk', 'stl', 'tov', 'fouls'
  ) then
    raise exception 'unknown event: %', p_event;
  end if;

  select gm.team_id into v_team_id
  from public.game_matches gm
  where gm.id = p_match_id and gm.team_id = public.current_team_id();
  if v_team_id is null then
    raise exception 'match not found';
  end if;

  insert into public.game_opponent_stat_lines (team_id, match_id, opponent_player_id)
  values (v_team_id, p_match_id, p_opponent_player_id)
  on conflict (match_id, opponent_player_id) do nothing;

  update public.game_opponent_stat_lines set
    fg_made = fg_made + case when p_event = 'fg_make' then p_delta else 0 end,
    fg_att = fg_att + case when p_event in ('fg_make', 'fg_miss') then p_delta else 0 end,
    ft_made = ft_made + case when p_event = 'ft_make' then p_delta else 0 end,
    ft_att = ft_att + case when p_event in ('ft_make', 'ft_miss') then p_delta else 0 end,
    pts = pts + case when p_event = 'fg_make' then p_delta * 2 when p_event = 'ft_make' then p_delta else 0 end,
    reb_off = reb_off + case when p_event = 'reb_off' then p_delta else 0 end,
    reb_def = reb_def + case when p_event = 'reb_def' then p_delta else 0 end,
    ast = ast + case when p_event = 'ast' then p_delta else 0 end,
    blk = blk + case when p_event = 'blk' then p_delta else 0 end,
    stl = stl + case when p_event = 'stl' then p_delta else 0 end,
    tov = tov + case when p_event = 'tov' then p_delta else 0 end,
    fouls = fouls + case when p_event = 'fouls' then p_delta else 0 end,
    updated_at = now()
  where match_id = p_match_id and opponent_player_id = p_opponent_player_id
  returning * into v_row;

  if v_row.fg_made < 0 or v_row.fg_att < v_row.fg_made
     or v_row.ft_made < 0 or v_row.ft_att < v_row.ft_made
     or v_row.reb_off < 0 or v_row.reb_def < 0 or v_row.ast < 0 or v_row.blk < 0
     or v_row.stl < 0 or v_row.tov < 0 or v_row.fouls < 0 then
    raise exception 'stat cannot go below zero';
  end if;

  insert into public.game_opponent_stat_events (team_id, match_id, opponent_player_id, quarter, event, delta)
  values (v_team_id, p_match_id, p_opponent_player_id, p_quarter, p_event, p_delta)
  returning id into v_event_id;

  return query select v_row, v_event_id;
end;
$$;

grant execute on function public.record_opponent_game_stat(uuid, uuid, int, text, int) to authenticated;

drop function if exists public.delete_game_stat_event(uuid);

create function public.delete_game_stat_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.game_stat_events;
begin
  if public.current_role() not in ('指導者', '管理者') then
    raise exception 'permission denied';
  end if;

  select * into v_event from public.game_stat_events where id = p_event_id;
  if v_event is null or v_event.team_id <> public.current_team_id() then
    raise exception 'event not found';
  end if;

  update public.game_player_stat_lines set
    fg_made = fg_made - case when v_event.event = 'fg_make' then v_event.delta else 0 end,
    fg_att = fg_att - case when v_event.event in ('fg_make', 'fg_miss') then v_event.delta else 0 end,
    ft_made = ft_made - case when v_event.event = 'ft_make' then v_event.delta else 0 end,
    ft_att = ft_att - case when v_event.event in ('ft_make', 'ft_miss') then v_event.delta else 0 end,
    pts = pts - case when v_event.event = 'fg_make' then v_event.delta * 2 when v_event.event = 'ft_make' then v_event.delta else 0 end,
    reb_off = reb_off - case when v_event.event = 'reb_off' then v_event.delta else 0 end,
    reb_def = reb_def - case when v_event.event = 'reb_def' then v_event.delta else 0 end,
    ast = ast - case when v_event.event = 'ast' then v_event.delta else 0 end,
    blk = blk - case when v_event.event = 'blk' then v_event.delta else 0 end,
    stl = stl - case when v_event.event = 'stl' then v_event.delta else 0 end,
    tov = tov - case when v_event.event = 'tov' then v_event.delta else 0 end,
    fouls = fouls - case when v_event.event = 'fouls' then v_event.delta else 0 end,
    updated_at = now()
  where match_id = v_event.match_id and player_id = v_event.player_id;

  delete from public.game_stat_events where id = p_event_id;
end;
$$;

grant execute on function public.delete_game_stat_event(uuid) to authenticated;

drop function if exists public.delete_opponent_game_stat_event(uuid);

create function public.delete_opponent_game_stat_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.game_opponent_stat_events;
begin
  if public.current_role() not in ('指導者', '管理者') then
    raise exception 'permission denied';
  end if;

  select * into v_event from public.game_opponent_stat_events where id = p_event_id;
  if v_event is null or v_event.team_id <> public.current_team_id() then
    raise exception 'event not found';
  end if;

  update public.game_opponent_stat_lines set
    fg_made = fg_made - case when v_event.event = 'fg_make' then v_event.delta else 0 end,
    fg_att = fg_att - case when v_event.event in ('fg_make', 'fg_miss') then v_event.delta else 0 end,
    ft_made = ft_made - case when v_event.event = 'ft_make' then v_event.delta else 0 end,
    ft_att = ft_att - case when v_event.event in ('ft_make', 'ft_miss') then v_event.delta else 0 end,
    pts = pts - case when v_event.event = 'fg_make' then v_event.delta * 2 when v_event.event = 'ft_make' then v_event.delta else 0 end,
    reb_off = reb_off - case when v_event.event = 'reb_off' then v_event.delta else 0 end,
    reb_def = reb_def - case when v_event.event = 'reb_def' then v_event.delta else 0 end,
    ast = ast - case when v_event.event = 'ast' then v_event.delta else 0 end,
    blk = blk - case when v_event.event = 'blk' then v_event.delta else 0 end,
    stl = stl - case when v_event.event = 'stl' then v_event.delta else 0 end,
    tov = tov - case when v_event.event = 'tov' then v_event.delta else 0 end,
    fouls = fouls - case when v_event.event = 'fouls' then v_event.delta else 0 end,
    updated_at = now()
  where match_id = v_event.match_id and opponent_player_id = v_event.opponent_player_id;

  delete from public.game_opponent_stat_events where id = p_event_id;
end;
$$;

grant execute on function public.delete_opponent_game_stat_event(uuid) to authenticated;

-- オールリセットは、スタッツ・スタメン・相手選手ロースターだけを対象にし、
-- 試合詳細画面で手入力された公式スコア(team_score/opponent_score)は今後触らない。
create or replace function public.reset_match_stats(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  if public.current_role() not in ('指導者', '管理者') then
    raise exception 'permission denied';
  end if;

  select gm.team_id into v_team_id
  from public.game_matches gm
  where gm.id = p_match_id and gm.team_id = public.current_team_id();
  if v_team_id is null then
    raise exception 'match not found';
  end if;

  delete from public.game_stat_events where match_id = p_match_id;
  delete from public.game_player_stat_lines where match_id = p_match_id;
  delete from public.game_records where match_id = p_match_id;
  delete from public.game_opponent_records where match_id = p_match_id;
  delete from public.game_opponent_players where match_id = p_match_id;
end;
$$;

grant execute on function public.reset_match_stats(uuid) to authenticated;
