-- 招待受諾時の選手選択に、在籍選手に加えてOB・OG(卒業済み)選手も選べるようにする
-- (選手本人が進級後に自分のアカウントを作る際、既にOB・OGになった自分を選べるようにするため)。
-- 既存の戻り値列にstatusを追加するため、列構成の変更はCREATE OR REPLACEではできず、
-- 一度DROPしてから作り直す。
drop function if exists public.get_invite_players(text);

create function public.get_invite_players(invite_token text)
returns table(id uuid, sei text, mei text, grade text, number text, status text)
language sql
stable security definer
set search_path to 'public'
as $$
  select p.id, p.sei, p.mei, p.grade, p.number, p.status
  from public.players p
  join public.invites i on i.team_id = p.team_id
  where i.token = invite_token
    and i.expires_at > now()
    and i.role = '一般'
    and p.status in ('在籍', 'OB・OG')
$$;

create or replace function public.accept_invite(invite_token text, member_name text, player_ids uuid[] default '{}'::uuid[], agreed_terms_version text default null, agreed_terms_at timestamp with time zone default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  inv record;
  member_email text;
  has_profile boolean;
  v_profile_created_at timestamptz;
begin
  if auth.uid() is null then
    raise exception '認証が必要です';
  end if;

  select * into inv from public.invites
    where token = invite_token and expires_at > now()
    for update;
  if not found then
    raise exception '招待リンクが無効か、有効期限が切れています';
  end if;

  select exists(select 1 from public.profiles where id = auth.uid()) into has_profile;

  if has_profile then
    if exists(select 1 from public.team_memberships where user_id = auth.uid() and team_id = inv.team_id) then
      raise exception '既にこのチームのメンバーです';
    end if;
    insert into public.team_memberships (user_id, team_id, role, status)
      values (auth.uid(), inv.team_id, inv.role, 'アクティブ');
  else
    select email into member_email from auth.users where id = auth.uid();
    insert into public.profiles (id, name, role, status, email, agreed_terms_version, agreed_terms_at)
      values (auth.uid(), member_name, inv.role, 'アクティブ', member_email, agreed_terms_version, agreed_terms_at)
      returning created_at into v_profile_created_at;
    insert into public.team_memberships (user_id, team_id, role, status, joined_at)
      values (auth.uid(), inv.team_id, inv.role, 'アクティブ', v_profile_created_at);
  end if;

  update public.invites set used_at = now(), used_by = auth.uid() where id = inv.id;

  if inv.role = '一般' and array_length(player_ids, 1) > 0 then
    insert into public.player_guardians (team_id, player_id, profile_id)
    select inv.team_id, p.id, auth.uid()
    from public.players p
    where p.id = any(player_ids) and p.team_id = inv.team_id and p.status in ('在籍', 'OB・OG')
    on conflict (player_id, profile_id) do nothing;
  end if;

  return inv.team_id;
end;
$$;
