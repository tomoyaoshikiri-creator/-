-- チームカテゴリー(小学生・中学生・高校生・大学生・その他)の追加。
-- これまでCLUB LINKは小学生年代のチームのみを前提にしていたが、機能の作り込み具合から
-- 中学生・高校生・大学生・一般(その他)のチームにも展開できると判断し、teamsに
-- カテゴリーを追加する。
--
-- players.gradeは絶対値の17段階スケールで管理する(0=未就学, 1-6=小学1-6年,
-- 7-9=中学1-3年, 10-12=高校1-3年, 13-16=大学1-4年)。既存のCHECK制約
-- (0005_obog_year_tracking.sqlで`grade is null or grade ~ '^[0-9]{1,2}$'`に
-- 緩和済み、0-99を許容)はこの範囲を既に許容しているため変更しない。
-- 「その他」カテゴリーは学年概念を持たない(gradeは常にnull)。

alter table public.teams add column category text not null default '小学生'
  check (category in ('小学生', '中学生', '高校生', '大学生', 'その他'));

-- 「ミニバスケットボール」は小学生カテゴリー専用(U12前提のルールのため)。
-- 既存のteams_sport_checkとは独立した制約として追加する。
alter table public.teams add constraint teams_category_sport_check
  check (category = '小学生' or sport <> 'ミニバスケットボール');

drop function if exists public.create_team_and_admin(text, text, text);

create or replace function public.create_team_and_admin(
  team_name text, admin_name text, team_sport text default 'ミニバスケットボール',
  team_category text default '小学生'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_team_id uuid;
begin
  if auth.uid() is null then
    raise exception '認証が必要です';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'このアカウントは既にチームに所属しています';
  end if;
  if team_sport not in (
    'バスケットボール', 'ミニバスケットボール', 'サッカー', 'フットサル',
    '野球', 'ハンドボール', 'ラグビー', 'バレーボール'
  ) then
    raise exception 'invalid sport: %', team_sport;
  end if;
  if team_category not in ('小学生', '中学生', '高校生', '大学生', 'その他') then
    raise exception 'invalid category: %', team_category;
  end if;
  if team_category <> '小学生' and team_sport = 'ミニバスケットボール' then
    raise exception 'ミニバスケットボールは小学生カテゴリーでのみ選択できます';
  end if;

  insert into public.teams (name, sport, category) values (team_name, team_sport, team_category) returning id into new_team_id;
  insert into public.profiles (id, team_id, name, role, status)
  values (auth.uid(), new_team_id, admin_name, '管理者', 'アクティブ');

  return new_team_id;
end;
$$;

grant execute on function public.create_team_and_admin(text, text, text, text) to authenticated;

-- 進級処理をカテゴリーごとの卒業学年に対応させる。その他カテゴリーはそもそも
-- 学年概念を持たないため、進級処理自体を行わない(訂正等で過去にgradeが
-- 残っていても、進級処理では一切触れない)。
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
  if tid is null or rl not in ('指導者', '管理者') then
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

drop function if exists public.get_invite_info(text);

create or replace function public.get_invite_info(invite_token text)
returns table(team_name text, role text, valid boolean, category text)
language sql
security definer
stable
set search_path = public
as $$
  select t.name, i.role, (i.expires_at > now()), t.category
  from public.invites i
  join public.teams t on t.id = i.team_id
  where i.token = invite_token
$$;
