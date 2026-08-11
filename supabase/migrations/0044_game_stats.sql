-- CLUB KARTE Phase C: 試合中のリアルタイムスタッツ入力。
-- 選手×試合で1行(game_player_stat_lines)、タップごとにRPC経由で加算する。
-- ミニバスケットボールはシュートが全て2点のため、FG成功=2点として計算する。

create table public.game_player_stat_lines (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  match_id uuid not null references public.game_matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  fg_made int not null default 0,
  fg_att int not null default 0,
  ft_made int not null default 0,
  ft_att int not null default 0,
  pts int not null default 0,
  reb_off int not null default 0,
  reb_def int not null default 0,
  ast int not null default 0,
  blk int not null default 0,
  stl int not null default 0,
  tov int not null default 0,
  fouls int not null default 0,
  reb int generated always as (reb_off + reb_def) stored,
  eff int generated always as (
    pts + reb_off + reb_def + ast + stl + blk
    - (fg_att - fg_made) - (ft_att - ft_made) - tov
  ) stored,
  updated_at timestamptz not null default now(),
  unique (match_id, player_id)
);
create index game_player_stat_lines_player_id_idx on public.game_player_stat_lines(player_id);

alter table public.game_player_stat_lines enable row level security;

create policy game_player_stat_lines_select on public.game_player_stat_lines for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy game_player_stat_lines_insert on public.game_player_stat_lines for insert
  with check (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy game_player_stat_lines_update on public.game_player_stat_lines for update
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy game_player_stat_lines_delete on public.game_player_stat_lines for delete
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

-- タップ1回ごとにこのRPCを呼び、DB側で原子的に加算する(p_delta=-1で取り消し)。
create or replace function public.record_game_stat(
  p_match_id uuid,
  p_player_id uuid,
  p_event text,
  p_delta int default 1
) returns public.game_player_stat_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_row public.game_player_stat_lines;
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

  return v_row;
end;
$$;

grant execute on function public.record_game_stat(uuid, uuid, text, int) to authenticated;
