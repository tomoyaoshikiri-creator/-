begin;

-- 0110で修正したprotect_profile_self_update()と同じ脆弱性クラス(current_role()/
-- current_team_id()をNOT IN・<>で「拒否条件」として使うと、NULLのときにPostgresの
-- 3値論理でガードが無効化されフェイルオープンする)が、既存の7関数・9箇所に
-- 存在することを実コード調査(自動grep+全文手動レビュー)で確認した。段階3c
-- (current_team_id()/current_role()をactive_team_sessions依存に切り替える)適用前に、
-- これらを独立して修正する。
--
-- game_stat_events/game_opponent_stat_eventsにはINSERTポリシーが存在せず、
-- これらSECURITY DEFINER関数内のロールチェックが唯一の認可ゲートであるため、
-- 実際に権限昇格・チーム越境操作につながりうる。

-- 1. record_game_stat: ロールチェックのみ修正
create or replace function public.record_game_stat(p_match_id uuid, p_player_id uuid, p_quarter integer, p_event text, p_delta integer default 1)
returns table(line game_player_stat_lines, event_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_row public.game_player_stat_lines;
  v_event_id uuid;
begin
  if coalesce(public.current_role(), '') not in ('指導者', '管理者') then
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

-- 2. record_opponent_game_stat: ロールチェックのみ修正
create or replace function public.record_opponent_game_stat(p_match_id uuid, p_opponent_player_id uuid, p_quarter integer, p_event text, p_delta integer default 1)
returns table(line game_opponent_stat_lines, event_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_row public.game_opponent_stat_lines;
  v_event_id uuid;
begin
  if coalesce(public.current_role(), '') not in ('指導者', '管理者') then
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

-- 3. delete_game_stat_event: ロールチェック + チーム所属チェック(<>)の2箇所を修正
create or replace function public.delete_game_stat_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.game_stat_events;
begin
  if coalesce(public.current_role(), '') not in ('指導者', '管理者') then
    raise exception 'permission denied';
  end if;

  select * into v_event from public.game_stat_events where id = p_event_id;
  if v_event is null or v_event.team_id is distinct from public.current_team_id() then
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

-- 4. delete_opponent_game_stat_event: ロールチェック + チーム所属チェック(<>)の2箇所を修正
create or replace function public.delete_opponent_game_stat_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.game_opponent_stat_events;
begin
  if coalesce(public.current_role(), '') not in ('指導者', '管理者') then
    raise exception 'permission denied';
  end if;

  select * into v_event from public.game_opponent_stat_events where id = p_event_id;
  if v_event is null or v_event.team_id is distinct from public.current_team_id() then
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

-- 5. reset_match_stats: ロールチェックのみ修正
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
  delete from public.game_records where match_id = p_match_id;
  delete from public.game_opponent_records where match_id = p_match_id;
  delete from public.game_opponent_players where match_id = p_match_id;
end;
$$;

-- 6. get_ai_analysis_usage: ロールチェックのみ修正(防御的)
create or replace function public.get_ai_analysis_usage()
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_team_id uuid := public.current_team_id();
  v_year_month text := to_char(now() at time zone 'Asia/Tokyo', 'YYYY-MM');
begin
  if v_team_id is null or coalesce(public.current_role(), '') not in ('指導者', '管理者') then
    return 0;
  end if;
  return public.ai_analysis_usage_count(v_team_id, v_year_month);
end;
$$;

-- 7. advance_academic_year: ロールチェックのみ修正
-- (current_role()の戻り値をローカル変数rlへ一度代入してからrl not inで判定していたため、
--  0111の当初の機械的grep(current_role() not inの直接マッチ)では検出できなかった。
--  tid is nullとの or 結合により、新current_team_id()/current_role()設計下では
--  tidが非NULLでrlのみNULLという状態は通常発生しない想定だが、role判定自体が
--  他条件の相関に依存せず単体でfail closedになるよう、防御的に修正する。)
create or replace function public.advance_academic_year()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid := public.current_team_id();
  rl text := public.current_role();
  cat text;
  grad_grade int;
begin
  if tid is null or coalesce(rl, '') not in ('指導者', '管理者') then
    raise exception '権限がありません';
  end if;

  select category into cat from public.teams where id = tid;
  if cat = 'その他' then
    return;
  end if;

  grad_grade := case cat
    when '小学生' then 6
    when '中学生' then 9
    when '高校生' then 12
    when '大学生' then 16
  end;

  -- 既にOB・OGの選手は、卒団からの経過年数として学年を+1する
  update public.players
    set grade = (grade::int + 1)::text
    where team_id = tid and status = 'OB・OG' and grade is not null;

  -- 卒業学年の選手は今回の年度更新でOB・OGへ卒団する(学年はこの回はまだ卒業学年のまま)
  update public.players
    set status = 'OB・OG'
    where team_id = tid and status <> 'OB・OG' and grade = grad_grade::text;

  -- 在籍中(卒業学年未満)の学年を+1する
  update public.players
    set grade = (grade::int + 1)::text
    where team_id = tid and status <> 'OB・OG' and grade is not null and grade::int < grad_grade;
end;
$$;

commit;
