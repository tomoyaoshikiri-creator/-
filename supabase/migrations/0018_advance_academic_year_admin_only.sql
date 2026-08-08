-- 年度更新(advance_academic_year)は誤操作の影響が大きいため、指導者では実行できないようにし、
-- 管理者のみに限定する(UI側のボタンも管理者にのみ表示するようにあわせて変更)。
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
  if tid is null or rl <> '管理者' then
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
