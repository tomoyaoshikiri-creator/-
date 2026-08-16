-- 保護者にもチームカルテの「試合記録」「スタッツ」「スポーツテスト」を見せるための下準備。
-- スタッツ・スポーツテストは選手個別の生データ(game_player_stat_lines / sports_test_records)を
-- 保護者に直接SELECTさせるとRLSを緩めるしかなく、他の子の個人データが見えてしまう。
-- そのためチーム平均だけを計算して返すSECURITY DEFINER関数を用意し、保護者にはこちらだけを
-- 実行させる(生テーブルのRLSは既存のまま、指導者・管理者限定を維持する)。

create or replace function public.team_game_stat_averages(p_fiscal_year int)
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
  ft_att_total int
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
  -- カウント系スタッツは「出場した各選手の個人平均」を選手数で単純平均する
  -- (試合数の重み付けはしない。src/lib/karteAggregate.ts の computeTeamAverages と同じ考え方)。
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
  -- FG%/FT%だけは全選手・全試合の成功数/試投数を合算した実際の割合を使う。
  totals as (
    select
      coalesce(sum(fg_made), 0) as fg_made_total,
      coalesce(sum(fg_att), 0) as fg_att_total,
      coalesce(sum(ft_made), 0) as ft_made_total,
      coalesce(sum(ft_att), 0) as ft_att_total
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
    (select ft_att_total from totals)::int
$$;

grant execute on function public.team_game_stat_averages(int) to authenticated;

create or replace function public.team_sports_test_averages(p_fiscal_year int, p_quarter int)
returns table (
  record_count int,
  wingspan_cm numeric,
  sprint20m numeric,
  lane_agility numeric,
  side_step numeric,
  shuttle_20m_x3 numeric,
  long_jump numeric,
  ball_throw numeric,
  back_fist_right numeric,
  back_fist_left numeric,
  ft_golf numeric,
  beep_test_reps numeric
)
language sql
security definer
stable
set search_path = public
as $$
  -- ①②の2回計測がある項目は、良い方の記録を採用する
  -- (src/lib/karteAggregate.ts の bestOf と同じ考え方。PostgresのLEAST/GREATESTはNULLを無視する)。
  with records as (
    select
      wingspan_cm,
      least(sprint20m_1, sprint20m_2) as sprint20m,
      least(lane_agility_1, lane_agility_2) as lane_agility,
      greatest(side_step_1, side_step_2) as side_step,
      shuttle_20m_x3,
      greatest(long_jump_1, long_jump_2) as long_jump,
      greatest(ball_throw_1, ball_throw_2) as ball_throw,
      back_fist_right,
      back_fist_left,
      ft_golf,
      beep_test_reps
    from public.sports_test_records
    where team_id = public.current_team_id()
      and fiscal_year = p_fiscal_year
      and quarter = p_quarter
      and not_conducted = false
  )
  select
    count(*)::int,
    round(avg(wingspan_cm), 1),
    round(avg(sprint20m), 1),
    round(avg(lane_agility), 1),
    round(avg(side_step), 1),
    round(avg(shuttle_20m_x3), 1),
    round(avg(long_jump), 1),
    round(avg(ball_throw), 1),
    round(avg(back_fist_right), 1),
    round(avg(back_fist_left), 1),
    round(avg(ft_golf), 1),
    round(avg(beep_test_reps), 1)
  from records
$$;

grant execute on function public.team_sports_test_averages(int, int) to authenticated;
