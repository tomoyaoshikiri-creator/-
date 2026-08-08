-- ユーザー管理画面で管理者だけがメールアドレスを確認できるようにする。
-- profiles.email はauth.usersのコピーで、チーム作成・招待受諾のタイミングで設定する。
-- 一般公開のRLSポリシー(profiles_select)には乗せず、専用のRPC(list_team_members)経由でのみ
-- 取得できるようにし、呼び出し元が管理者でない場合はemailをnullにして返す。

alter table public.profiles add column email text;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

create or replace function public.create_team_and_admin(team_name text, admin_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_team_id uuid;
  admin_email text;
begin
  if auth.uid() is null then
    raise exception '認証が必要です';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'このアカウントは既にチームに所属しています';
  end if;

  select email into admin_email from auth.users where id = auth.uid();

  insert into public.teams (name) values (team_name) returning id into new_team_id;
  insert into public.profiles (id, team_id, name, role, status, email)
  values (auth.uid(), new_team_id, admin_name, '管理者', 'アクティブ', admin_email);

  return new_team_id;
end;
$$;

create or replace function public.accept_invite(invite_token text, member_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  member_email text;
begin
  if auth.uid() is null then
    raise exception '認証が必要です';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'このアカウントは既にチームに所属しています';
  end if;

  select * into inv from public.invites
    where token = invite_token and used_at is null and expires_at > now()
    for update;

  if not found then
    raise exception '招待リンクが無効か、有効期限が切れています';
  end if;

  select email into member_email from auth.users where id = auth.uid();

  insert into public.profiles (id, team_id, name, role, status, email)
  values (auth.uid(), inv.team_id, member_name, inv.role, 'アクティブ', member_email);

  update public.invites set used_at = now(), used_by = auth.uid() where id = inv.id;

  return inv.team_id;
end;
$$;

create or replace function public.list_team_members()
returns table (
  id uuid,
  name text,
  role text,
  status text,
  email text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.role,
    p.status,
    case when public.current_role() = '管理者' then p.email else null end as email,
    p.created_at
  from public.profiles p
  where p.team_id = public.current_team_id()
  order by p.created_at asc;
$$;
grant execute on function public.list_team_members() to authenticated;
