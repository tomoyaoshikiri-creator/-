-- 複数競技対応 Phase C: バスケットボール(ミニバスケットボールではなく通常ルール)向けに
-- 3ポイントシュートの内訳カラムを追加する。
--
-- fg_made/fg_attは今まで通り「(2P+3Pの)フィールドゴール合算」の意味を保つ
-- (ミニバスケットボールは3P試投が常に0のため、既存の意味・既存データに一切影響しない)。
-- 3P成功/失敗イベントはfg_made/fg_attとthree_made/three_attの両方を更新する
-- (3ポイントも「3点が入るフィールドゴール」であるため)。この設計によりeff生成列は
-- fg_att/fg_madeをそのまま参照し続ければよく、変更不要。

alter table public.game_player_stat_lines add column three_made int not null default 0;
alter table public.game_player_stat_lines add column three_att int not null default 0;
alter table public.game_opponent_stat_lines add column three_made int not null default 0;
alter table public.game_opponent_stat_lines add column three_att int not null default 0;

create or replace function public.record_game_stat(
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
    'fg_make', 'fg_miss', 'three_make', 'three_miss', 'ft_make', 'ft_miss',
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
    fg_made = fg_made + case when p_event in ('fg_make', 'three_make') then p_delta else 0 end,
    fg_att = fg_att + case when p_event in ('fg_make', 'fg_miss', 'three_make', 'three_miss') then p_delta else 0 end,
    three_made = three_made + case when p_event = 'three_make' then p_delta else 0 end,
    three_att = three_att + case when p_event in ('three_make', 'three_miss') then p_delta else 0 end,
    ft_made = ft_made + case when p_event = 'ft_make' then p_delta else 0 end,
    ft_att = ft_att + case when p_event in ('ft_make', 'ft_miss') then p_delta else 0 end,
    pts = pts + case
      when p_event = 'fg_make' then p_delta * 2
      when p_event = 'three_make' then p_delta * 3
      when p_event = 'ft_make' then p_delta
      else 0 end,
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
     or v_row.three_made < 0 or v_row.three_att < v_row.three_made or v_row.three_made > v_row.fg_made
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

create or replace function public.record_opponent_game_stat(
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
    'fg_make', 'fg_miss', 'three_make', 'three_miss', 'ft_make', 'ft_miss',
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
    fg_made = fg_made + case when p_event in ('fg_make', 'three_make') then p_delta else 0 end,
    fg_att = fg_att + case when p_event in ('fg_make', 'fg_miss', 'three_make', 'three_miss') then p_delta else 0 end,
    three_made = three_made + case when p_event = 'three_make' then p_delta else 0 end,
    three_att = three_att + case when p_event in ('three_make', 'three_miss') then p_delta else 0 end,
    ft_made = ft_made + case when p_event = 'ft_make' then p_delta else 0 end,
    ft_att = ft_att + case when p_event in ('ft_make', 'ft_miss') then p_delta else 0 end,
    pts = pts + case
      when p_event = 'fg_make' then p_delta * 2
      when p_event = 'three_make' then p_delta * 3
      when p_event = 'ft_make' then p_delta
      else 0 end,
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
     or v_row.three_made < 0 or v_row.three_att < v_row.three_made or v_row.three_made > v_row.fg_made
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

create or replace function public.delete_game_stat_event(p_event_id uuid)
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
    fg_made = fg_made - case when v_event.event in ('fg_make', 'three_make') then v_event.delta else 0 end,
    fg_att = fg_att - case when v_event.event in ('fg_make', 'fg_miss', 'three_make', 'three_miss') then v_event.delta else 0 end,
    three_made = three_made - case when v_event.event = 'three_make' then v_event.delta else 0 end,
    three_att = three_att - case when v_event.event in ('three_make', 'three_miss') then v_event.delta else 0 end,
    ft_made = ft_made - case when v_event.event = 'ft_make' then v_event.delta else 0 end,
    ft_att = ft_att - case when v_event.event in ('ft_make', 'ft_miss') then v_event.delta else 0 end,
    pts = pts - case
      when v_event.event = 'fg_make' then v_event.delta * 2
      when v_event.event = 'three_make' then v_event.delta * 3
      when v_event.event = 'ft_make' then v_event.delta
      else 0 end,
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

create or replace function public.delete_opponent_game_stat_event(p_event_id uuid)
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
    fg_made = fg_made - case when v_event.event in ('fg_make', 'three_make') then v_event.delta else 0 end,
    fg_att = fg_att - case when v_event.event in ('fg_make', 'fg_miss', 'three_make', 'three_miss') then v_event.delta else 0 end,
    three_made = three_made - case when v_event.event = 'three_make' then v_event.delta else 0 end,
    three_att = three_att - case when v_event.event in ('three_make', 'three_miss') then v_event.delta else 0 end,
    ft_made = ft_made - case when v_event.event = 'ft_make' then v_event.delta else 0 end,
    ft_att = ft_att - case when v_event.event in ('ft_make', 'ft_miss') then v_event.delta else 0 end,
    pts = pts - case
      when v_event.event = 'fg_make' then v_event.delta * 2
      when v_event.event = 'three_make' then v_event.delta * 3
      when v_event.event = 'ft_make' then v_event.delta
      else 0 end,
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

-- 保護者向けチーム平均RPC(0076)にも3Pの合算値を追加する。2P%/3P%はクライアント側
-- (src/lib/karteAggregate.ts)でfg_made_total/fg_att_totalとの差分から算出する。
drop function if exists public.team_game_stat_averages(int);

create function public.team_game_stat_averages(p_fiscal_year int)
returns table (
  player_count int,
  pts numeric,
  fg_pct numeric,
  ft_pct numeric,
  ast numeric,
  reb_off numeric,
  reb_def numeric,
  stl numeric,
  blk numeric,
  tov numeric,
  eff numeric,
  fg_made_total int,
  fg_att_total int,
  ft_made_total int,
  ft_att_total int,
  three_made_total int,
  three_att_total int
)
language sql
security definer
stable
set search_path = public
as $$
  with lines as (
    select gpsl.*
    from public.game_player_stat_lines gpsl
    join public.game_matches gm on gm.id = gpsl.match_id
    join public.schedules s on s.id = gm.schedule_id
    where gpsl.team_id = public.current_team_id()
      and coalesce(
        s.fiscal_year_override,
        case when extract(month from s.date)::int >= 4
          then extract(year from s.date)::int
          else extract(year from s.date)::int - 1
        end
      ) = p_fiscal_year
  ),
  per_player as (
    select
      player_id,
      avg(pts) as pts,
      avg(reb_off) as reb_off,
      avg(reb_def) as reb_def,
      avg(ast) as ast,
      avg(stl) as stl,
      avg(blk) as blk,
      avg(tov) as tov,
      avg(eff) as eff
    from lines
    group by player_id
  ),
  totals as (
    select
      coalesce(sum(fg_made), 0) as fg_made_total,
      coalesce(sum(fg_att), 0) as fg_att_total,
      coalesce(sum(ft_made), 0) as ft_made_total,
      coalesce(sum(ft_att), 0) as ft_att_total,
      coalesce(sum(three_made), 0) as three_made_total,
      coalesce(sum(three_att), 0) as three_att_total
    from lines
  )
  select
    (select count(*) from per_player)::int,
    (select round(avg(pts), 1) from per_player),
    case when (select fg_att_total from totals) > 0
      then round((select fg_made_total from totals)::numeric / (select fg_att_total from totals) * 100, 1)
      else null end,
    case when (select ft_att_total from totals) > 0
      then round((select ft_made_total from totals)::numeric / (select ft_att_total from totals) * 100, 1)
      else null end,
    (select round(avg(ast), 1) from per_player),
    (select round(avg(reb_off), 1) from per_player),
    (select round(avg(reb_def), 1) from per_player),
    (select round(avg(stl), 1) from per_player),
    (select round(avg(blk), 1) from per_player),
    (select round(avg(tov), 1) from per_player),
    (select round(avg(eff), 1) from per_player),
    (select fg_made_total from totals)::int,
    (select fg_att_total from totals)::int,
    (select ft_made_total from totals)::int,
    (select ft_att_total from totals)::int,
    (select three_made_total from totals)::int,
    (select three_att_total from totals)::int
$$;

grant execute on function public.team_game_stat_averages(int) to authenticated;
