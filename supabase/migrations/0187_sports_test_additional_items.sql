-- スポーツテストの記録用紙(1人1枚)に合わせた新規項目追加:
-- 切り替えラン・コースドリブル(利き手/逆手)・ペイント付近シュート。
-- 切り替えラン・コースドリブルは既存のsprint20m/lane_agility等と同じ
-- 「秒数・2回計測(良い方を採用)」形式。ペイント付近シュートはft_golfと
-- 同じ「10本中の成功数」形式。
alter table public.sports_test_records
  add column change_direction_run_1 numeric(4,2),
  add column change_direction_run_2 numeric(4,2),
  add column course_dribble_dominant_1 numeric(4,2),
  add column course_dribble_dominant_2 numeric(4,2),
  add column course_dribble_opposite_1 numeric(4,2),
  add column course_dribble_opposite_2 numeric(4,2),
  add column paint_shot int check (paint_shot between 0 and 10);

-- team_sports_test_averages(保護者向けチーム平均)の戻り値の列構成が変わるため、
-- create or replaceではなく一度dropしてから作り直す。
drop function if exists public.team_sports_test_averages(int, int);

create function public.team_sports_test_averages(p_fiscal_year int, p_quarter int)
returns table (
  record_count int,
  wingspan_cm numeric,
  sprint20m numeric,
  long_jump numeric,
  change_direction_run numeric,
  lane_agility numeric,
  side_step numeric,
  shuttle_20m_x3 numeric,
  beep_test_reps numeric,
  back_fist_right numeric,
  back_fist_left numeric,
  ball_throw numeric,
  course_dribble_dominant numeric,
  course_dribble_opposite numeric,
  ft_golf numeric,
  paint_shot numeric
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
      greatest(long_jump_1, long_jump_2) as long_jump,
      least(change_direction_run_1, change_direction_run_2) as change_direction_run,
      least(lane_agility_1, lane_agility_2) as lane_agility,
      greatest(side_step_1, side_step_2) as side_step,
      shuttle_20m_x3,
      beep_test_reps,
      back_fist_right,
      back_fist_left,
      greatest(ball_throw_1, ball_throw_2) as ball_throw,
      least(course_dribble_dominant_1, course_dribble_dominant_2) as course_dribble_dominant,
      least(course_dribble_opposite_1, course_dribble_opposite_2) as course_dribble_opposite,
      ft_golf,
      paint_shot
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
    round(avg(long_jump), 1),
    round(avg(change_direction_run), 1),
    round(avg(lane_agility), 1),
    round(avg(side_step), 1),
    round(avg(shuttle_20m_x3), 1),
    round(avg(beep_test_reps), 1),
    round(avg(back_fist_right), 1),
    round(avg(back_fist_left), 1),
    round(avg(ball_throw), 1),
    round(avg(course_dribble_dominant), 1),
    round(avg(course_dribble_opposite), 1),
    round(avg(ft_golf), 1),
    round(avg(paint_shot), 1)
  from records
$$;

grant execute on function public.team_sports_test_averages(int, int) to authenticated;
