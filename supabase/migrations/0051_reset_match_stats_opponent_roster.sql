-- オールリセットで、相手選手の背番号ロースター(game_opponent_players)自体も削除する。
-- game_opponent_stat_lines/eventsはgame_opponent_playersへのon delete cascadeで追従して消えるが、
-- game_opponent_records(uuid配列でIDを保持するだけでFK制約がない)は明示的に削除する。

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

  update public.game_matches
  set team_score = null, opponent_score = null
  where id = p_match_id;
end;
$$;

grant execute on function public.reset_match_stats(uuid) to authenticated;
