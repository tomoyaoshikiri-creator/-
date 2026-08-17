-- 複数競技対応の追加: 既存の仕組み(チーム対抗・ポジション・カスタムスタッツ)に
-- そのまま乗せられる競技として、フットサル・ハンドボール・ラグビーを追加する。

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.teams'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%(sport =%';
  if cname is not null then
    execute format('alter table public.teams drop constraint %I', cname);
  end if;
end $$;

alter table public.teams add constraint teams_sport_check check (sport in (
  'バスケットボール', 'ミニバスケットボール', 'サッカー', 'フットサル',
  '野球', 'ハンドボール', 'ラグビー', 'バレーボール'
));

drop function if exists public.create_team_and_admin(text, text, text);

create or replace function public.create_team_and_admin(
  team_name text, admin_name text, team_sport text default 'ミニバスケットボール'
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

  insert into public.teams (name, sport) values (team_name, team_sport) returning id into new_team_id;
  insert into public.profiles (id, team_id, name, role, status)
  values (auth.uid(), new_team_id, admin_name, '管理者', 'アクティブ');

  return new_team_id;
end;
$$;

grant execute on function public.create_team_and_admin(text, text, text) to authenticated;

-- ポジション選択肢を拡張する。フットサルはサッカーと同じGK/DF/MF/FWを流用し、
-- ハンドボール・ラグビーは新規コードを追加する。
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.players'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%positions%';
  if cname is not null then
    execute format('alter table public.players drop constraint %I', cname);
  end if;
end $$;

alter table public.players add constraint players_positions_check
  check (positions <@ array[
    'PG','SG','SF','PF','C',
    'GK','DF','MF','FW',
    '投','捕','一','二','三','遊','左','中','右',
    'S','OH','MB','OP','L',
    'LB','CB','RB','LW','RW','PV',
    'PR','HO','LO','FL','N8','SH','SO','CTB','WTB','FB'
  ]);
