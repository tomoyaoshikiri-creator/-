-- サッカー・ミニサッカー/野球・軟式野球の名称をシンプルに「サッカー」「野球」に変更する。
-- 他チームはまだ存在しないため既存データへの実質的な影響はない
-- (都賀ビクトリーズはミニバスケットボールのままなので無関係)。

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

update public.teams set sport = 'サッカー' where sport = 'サッカー・ミニサッカー';
update public.teams set sport = '野球' where sport = '野球・軟式野球';

alter table public.teams add constraint teams_sport_check check (sport in (
  'バスケットボール', 'ミニバスケットボール', 'サッカー', '野球', 'バレーボール'
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
  if team_sport not in ('バスケットボール','ミニバスケットボール','サッカー','野球','バレーボール') then
    raise exception 'invalid sport: %', team_sport;
  end if;

  insert into public.teams (name, sport) values (team_name, team_sport) returning id into new_team_id;
  insert into public.profiles (id, team_id, name, role, status)
  values (auth.uid(), new_team_id, admin_name, '管理者', 'アクティブ');

  return new_team_id;
end;
$$;

grant execute on function public.create_team_and_admin(text, text, text) to authenticated;
