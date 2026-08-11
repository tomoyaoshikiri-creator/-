-- 相手チームもクォーターごとにスタメン(最大5人)・途中出場を記録できるようにする。
-- game_recordsと同じ考え方だが、対象がplayersではなくgame_opponent_playersになる。

create table public.game_opponent_records (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  match_id uuid not null references public.game_matches(id) on delete cascade,
  quarter int not null check (quarter between 1 and 4),
  starter_opponent_player_ids uuid[] not null default '{}'
    check (
      array_length(starter_opponent_player_ids, 1) is null
      or array_length(starter_opponent_player_ids, 1) <= 5
    ),
  sub_opponent_player_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (match_id, quarter)
);

alter table public.game_opponent_records enable row level security;
create policy game_opponent_records_select on public.game_opponent_records for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy game_opponent_records_insert on public.game_opponent_records for insert
  with check (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy game_opponent_records_update on public.game_opponent_records for update
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy game_opponent_records_delete on public.game_opponent_records for delete
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

-- オールリセットの対象に相手チームのスタメン記録も含める。
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
  delete from public.game_opponent_stat_events where match_id = p_match_id;
  delete from public.game_opponent_stat_lines where match_id = p_match_id;
  delete from public.game_records where match_id = p_match_id;
  delete from public.game_opponent_records where match_id = p_match_id;

  update public.game_matches
  set team_score = null, opponent_score = null
  where id = p_match_id;
end;
$$;

grant execute on function public.reset_match_stats(uuid) to authenticated;
