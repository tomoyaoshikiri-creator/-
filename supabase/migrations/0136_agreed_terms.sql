begin;

-- 利用規約・プライバシーポリシーへの同意バージョン管理(A-2)。
-- profiles行が作られるタイミング(create_team_and_admin/accept_invite、いずれも
-- has_profile=falseの新規ユーザー分岐)で、同意したバージョン文字列と日時を記録する。
-- 既存ユーザーの再同意フローは別PRの対象(このmigrationでは遡及入力しない。
-- 既存行はagreed_terms_version/agreed_terms_atともにnullのままになる)。
alter table public.profiles
  add column agreed_terms_version text,
  add column agreed_terms_at timestamptz;

-- create_team_and_admin(): has_profile=false(新規ユーザーの初回チーム作成)の
-- profiles INSERTにのみ2列を追加。has_profile=true(既存ユーザーの2件目以降の
-- チーム作成、settings/teams/new)は元からprofilesに触れない分岐のため無関係。
-- 追加パラメータはdefault nullでシグネチャ末尾に追加しており、既存の呼び出し
-- (settings/teams/new/actions.ts、値を渡さない)には影響しない。
create or replace function public.create_team_and_admin(
  team_name text, admin_name text, team_sport text default 'ミニバスケットボール',
  team_category text default '小学生', agreed_terms_version text default null,
  agreed_terms_at timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_team_id uuid;
  has_profile boolean;
  v_profile_created_at timestamptz;
begin
  if auth.uid() is null then
    raise exception '認証が必要です';
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

  select exists(select 1 from public.profiles where id = auth.uid()) into has_profile;

  insert into public.teams (name, sport, category) values (team_name, team_sport, team_category) returning id into new_team_id;

  if has_profile then
    insert into public.team_memberships (user_id, team_id, role, status)
      values (auth.uid(), new_team_id, '管理者', 'アクティブ');
  else
    insert into public.profiles (id, name, role, status, agreed_terms_version, agreed_terms_at)
      values (auth.uid(), admin_name, '管理者', 'アクティブ', agreed_terms_version, agreed_terms_at)
      returning created_at into v_profile_created_at;
    insert into public.team_memberships (user_id, team_id, role, status, joined_at)
      values (auth.uid(), new_team_id, '管理者', 'アクティブ', v_profile_created_at);
  end if;

  return new_team_id;
end;
$$;

-- accept_invite(): has_profile=false(招待経由の新規ユーザー)のprofiles INSERTに
-- のみ2列を追加。has_profile=true(既存ユーザーが別チームの招待を受諾、
-- acceptInviteAsExistingUser)は元からprofilesに触れない分岐のため無関係。
create or replace function public.accept_invite(
  invite_token text, member_name text, player_ids uuid[] default '{}',
  agreed_terms_version text default null, agreed_terms_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
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
    where p.id = any(player_ids) and p.team_id = inv.team_id and p.status = '在籍'
    on conflict (player_id, profile_id) do nothing;
  end if;

  return inv.team_id;
end;
$$;

commit;
