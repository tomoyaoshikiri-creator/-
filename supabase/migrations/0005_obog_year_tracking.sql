-- OB・OGの卒団後経過年数を追跡できるように grade を6より先も伸ばせるようにする。
-- grade は「卒団時の学年(6) + 卒団してからの年度更新回数」として扱う。
-- 画面上は7以上の値を「7年生」などとは表示せず、OB・OGの経過年数(卒団N年目)として表示する。

alter table public.players drop constraint if exists players_grade_check;
alter table public.players
  add constraint players_grade_check check (grade is null or grade ~ '^[0-9]{1,2}$');

create or replace function public.advance_academic_year()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid := public.current_team_id();
  rl text := public.current_role();
begin
  if tid is null or rl not in ('指導者', '管理者') then
    raise exception '権限がありません';
  end if;

  -- 既にOB・OGの選手は、卒団からの経過年数として学年を+1する
  update public.players
    set grade = (grade::int + 1)::text
    where team_id = tid and status = 'OB・OG' and grade is not null;

  -- 6年生は今回の年度更新でOB・OGへ卒団する(学年はこの回はまだ6のまま)
  update public.players
    set status = 'OB・OG'
    where team_id = tid and status <> 'OB・OG' and grade = '6';

  -- 在籍中(6年未満)の学年を+1する
  update public.players
    set grade = (grade::int + 1)::text
    where team_id = tid and status <> 'OB・OG' and grade is not null and grade::int < 6;
end;
$$;
