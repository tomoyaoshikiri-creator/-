-- 記録ログの編集(クォーターの修正)・削除(集計への反映を取り消す)を可能にする。

create policy game_stat_events_update on public.game_stat_events for update
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'))
  with check (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

create policy game_opponent_stat_events_update on public.game_opponent_stat_events for update
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'))
  with check (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

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

  update public.game_matches
  set team_score = greatest(0, coalesce(team_score, 0) - case
    when v_event.event = 'fg_make' then v_event.delta * 2
    when v_event.event = 'ft_make' then v_event.delta
    else 0
  end)
  where id = v_event.match_id;

  delete from public.game_stat_events where id = p_event_id;
end;
$$;

grant execute on function public.delete_game_stat_event(uuid) to authenticated;

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

  update public.game_matches
  set opponent_score = greatest(0, coalesce(opponent_score, 0) - case
    when v_event.event = 'fg_make' then v_event.delta * 2
    when v_event.event = 'ft_make' then v_event.delta
    else 0
  end)
  where id = v_event.match_id;

  delete from public.game_opponent_stat_events where id = p_event_id;
end;
$$;

grant execute on function public.delete_opponent_game_stat_event(uuid) to authenticated;
