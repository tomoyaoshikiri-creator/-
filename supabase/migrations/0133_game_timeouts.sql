-- スタッツ入力画面にタイムアウトの記録ボタンを追加する。
-- 選手に紐づくスタッツ(game_stat_events等)とは異なり、タイムアウトはチーム単位(自チーム/相手チーム)
-- の記録のため、既存のgame_stat_events/game_opponent_stat_eventsとは別に、sideカラムで
-- 自チーム/相手チームを区別する専用テーブルを1つだけ持つ(件数=回数として集計するだけなので、
-- fg_made等のような集計行(_stat_lines)は不要)。

create table public.game_timeout_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  match_id uuid not null references public.game_matches(id) on delete cascade,
  side text not null check (side in ('own', 'opponent')),
  quarter int not null,
  created_at timestamptz not null default now()
);
create index game_timeout_events_match_id_idx on public.game_timeout_events(match_id);

alter table public.game_timeout_events enable row level security;

-- game_stat_events(0045)と同じ方針: INSERT/DELETEポリシーは持たず、SECURITY DEFINER関数内の
-- ロールチェックのみを認可ゲートとする(0111のNULL安全化パターンに合わせcoalesce(...,'')で判定)。
create policy game_timeout_events_select on public.game_timeout_events for select
  using (team_id = public.current_team_id() and coalesce(public.current_role(), '') in ('指導者', '管理者'));

create or replace function public.record_game_timeout(p_match_id uuid, p_side text, p_quarter int)
returns public.game_timeout_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_row public.game_timeout_events;
begin
  if coalesce(public.current_role(), '') not in ('指導者', '管理者') then
    raise exception 'permission denied';
  end if;
  if p_side not in ('own', 'opponent') then
    raise exception 'unknown side: %', p_side;
  end if;

  select gm.team_id into v_team_id
  from public.game_matches gm
  where gm.id = p_match_id and gm.team_id = public.current_team_id();
  if v_team_id is null then
    raise exception 'match not found';
  end if;

  insert into public.game_timeout_events (team_id, match_id, side, quarter)
  values (v_team_id, p_match_id, p_side, p_quarter)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.record_game_timeout(uuid, text, int) to authenticated;

create or replace function public.delete_game_timeout_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.game_timeout_events;
begin
  if coalesce(public.current_role(), '') not in ('指導者', '管理者') then
    raise exception 'permission denied';
  end if;

  select * into v_event from public.game_timeout_events where id = p_event_id;
  if v_event is null or v_event.team_id is distinct from public.current_team_id() then
    raise exception 'event not found';
  end if;

  delete from public.game_timeout_events where id = p_event_id;
end;
$$;

grant execute on function public.delete_game_timeout_event(uuid) to authenticated;

-- reset_match_stats(0111)にgame_timeout_eventsの削除を追加する(関数本体は0111時点のものを踏襲)。
create or replace function public.reset_match_stats(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  if coalesce(public.current_role(), '') not in ('指導者', '管理者') then
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
  delete from public.game_timeout_events where match_id = p_match_id;
  delete from public.game_records where match_id = p_match_id;
  delete from public.game_opponent_records where match_id = p_match_id;
  delete from public.game_opponent_players where match_id = p_match_id;
end;
$$;
