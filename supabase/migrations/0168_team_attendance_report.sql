-- 出欠の集計レポート(クラウド指示書 M-2)。指導者・管理者が期間・予定種別を指定して、
-- 選手ごとの対象予定数・出席/欠席/遅刻早退/見学の件数を見られるようにする。
-- 生のattendances/schedulesテーブルは指導者・管理者であれば既存RLS(schedules_select /
-- attendances_select、0001_init.sqlから未変更)でチーム全体を読めるが、件数が多い場合に
-- クライアント側で全件取得して集計するのは非効率なため、DB側で集計するSECURITY DEFINER
-- 関数を用意する(team_sports_test_averagesと同じ方針)。
--
-- 共通ルールに合わせ、デフォルトで実行権限を剥奪したうえでauthenticatedにのみ再許可する。
-- ユーザー操作から直接呼ばれるRPCのため、関数内でもcurrent_role()によるスタッフ判定を
-- 行い(WHERE条件がfalseになるだけで、非スタッフからの呼び出しは常に0件を返す。
-- current_team_id()/current_role()は未ログイン・非メンバーだとnullを返すため安全側に働く)。
create or replace function public.team_attendance_report(p_from date, p_to date, p_schedule_type text default null)
returns table (
  player_id uuid,
  sei text,
  mei text,
  grade text,
  number text,
  eligible_count int,
  present_count int,
  absent_count int,
  late_count int,
  observe_count int
)
language sql
security definer
stable
set search_path = public
as $$
  with eligible as (
    select p.id as player_id, p.sei, p.mei, p.grade, p.number, s.id as schedule_id
    from public.players p
    cross join public.schedules s
    where public.current_role() in ('指導者', '管理者')
      and p.team_id = public.current_team_id()
      and p.status = '在籍'
      and s.team_id = public.current_team_id()
      and s.date between p_from and p_to
      and s.requires_attendance = true
      and (p_schedule_type is null or s.type = p_schedule_type)
      and (
        s.target_grade_min is null
        or (
          p.grade ~ '^[0-9]+$' and s.target_grade_min ~ '^[0-9]+$'
          and p.grade::int >= s.target_grade_min::int
        )
      )
  )
  select
    e.player_id,
    e.sei,
    e.mei,
    e.grade,
    e.number,
    count(*)::int as eligible_count,
    count(*) filter (where a.status = '出席')::int as present_count,
    count(*) filter (where a.status = '欠席')::int as absent_count,
    count(*) filter (where a.status = '遅刻早退')::int as late_count,
    count(*) filter (where a.status = '見学')::int as observe_count
  from eligible e
  left join public.attendances a on a.schedule_id = e.schedule_id and a.player_id = e.player_id
  group by e.player_id, e.sei, e.mei, e.grade, e.number
$$;

revoke all on function public.team_attendance_report(date, date, text) from public, authenticated, anon;
grant execute on function public.team_attendance_report(date, date, text) to authenticated;
