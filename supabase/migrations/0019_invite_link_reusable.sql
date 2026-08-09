-- 招待リンクを、同じロール(保護者用/指導者用)の複数人が使い回せるようにする。
-- これまでは1回登録に使われると(used_atが記録されると)以降は無効になっていたが、
-- 有効期限内であれば繰り返し使えるようにする。あわせて有効期限のデフォルトを
-- 30日から3日に短縮する(今後発行するリンクにのみ適用され、既存の招待には影響しない)。

alter table public.invites alter column expires_at set default (now() + interval '3 days');

create or replace function public.get_invite_info(invite_token text)
returns table(team_name text, role text, valid boolean)
language sql
security definer
stable
set search_path = public
as $$
  select t.name, i.role, (i.expires_at > now())
  from public.invites i
  join public.teams t on t.id = i.team_id
  where i.token = invite_token
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
    where token = invite_token and expires_at > now()
    for update;

  if not found then
    raise exception '招待リンクが無効か、有効期限が切れています';
  end if;

  select email into member_email from auth.users where id = auth.uid();

  insert into public.profiles (id, team_id, name, role, status, email)
  values (auth.uid(), inv.team_id, member_name, inv.role, 'アクティブ', member_email);

  -- used_at/used_byは「最後に使われた日時・人」の参考情報として更新するのみで、
  -- 以降の利用を止める用途ではもう使わない。
  update public.invites set used_at = now(), used_by = auth.uid() where id = inv.id;

  return inv.team_id;
end;
$$;
