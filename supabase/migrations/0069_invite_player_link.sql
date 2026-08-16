-- 招待受諾(保護者/一般ロール)の際に、自分の子どもをその場で選んで紐付けられるようにする。
-- 紐付けの一般的な追加・削除は引き続き管理者限定(player_guardians_insert/deleteのRLS)のまま変更しない。
-- ここではSECURITY DEFINERのaccept_invite関数内でのみ、招待されたチームに所属する在籍選手に
-- 限定して紐付けを追加できるようにする(招待リンクを受け取った本人が対象、かつ対象チームの
-- 在籍選手以外は選べないため、安全性は損なわない)。

-- 招待リンクの有効性を確認したうえで、そのチームの在籍選手一覧を返す(未ログインの招待受諾画面から呼ぶ)。
create or replace function public.get_invite_players(invite_token text)
returns table(id uuid, sei text, mei text, grade text, number text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.sei, p.mei, p.grade, p.number
  from public.players p
  join public.invites i on i.team_id = p.team_id
  where i.token = invite_token
    and i.expires_at > now()
    and i.role = '一般'
    and p.status = '在籍'
$$;

drop function if exists public.accept_invite(text, text);

create or replace function public.accept_invite(invite_token text, member_name text, player_ids uuid[] default '{}')
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

  if inv.role = '一般' and array_length(player_ids, 1) > 0 then
    insert into public.player_guardians (team_id, player_id, profile_id)
    select inv.team_id, p.id, auth.uid()
    from public.players p
    where p.id = any(player_ids) and p.team_id = inv.team_id and p.status = '在籍'
    on conflict (player_id, profile_id) do nothing;
  end if;

  return inv.team_id;
end;
$$;
