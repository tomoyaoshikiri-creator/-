begin;

-- 複数チーム所属基盤 段階3d-2 Step2: create_team_and_admin()/accept_invite()の
-- dual-path化。「既存ユーザー(profiles行あり)による2件目以降のteam_memberships作成」
-- を解禁する。
--
-- 変更点は両関数とも共通で、冒頭の
--   if exists (select 1 from public.profiles where id = auth.uid()) then
--     raise exception 'このアカウントは既にチームに所属しています';
--   end if;
-- を削除し、代わりに has_profile 分岐を追加しただけ:
--   - has_profile = false (新規ユーザー): 既存の挙動を完全維持。profilesへINSERTし、
--     trg_sync_profile_to_team_membershipがteam_membershipsを自動生成する。
--   - has_profile = true (既存ユーザーの2件目以降): profilesには一切触れず、
--     team_membershipsへ直接INSERTする。profiles.team_id/role/statusは
--     2件目以降には同期しないlegacy情報のままとする設計方針による。
-- 上記以外(sport/category検証、招待の有効期限チェック、player_guardians紐付け等)は
-- 現行(create_team_and_admin: 0103、accept_invite: 0069)から一切変更していない。
--
-- accept_invite側は、has_profile = trueの場合に限り、同一team_idへの重複加入を
-- 明示チェックして拒否する('既にこのチームのメンバーです')。招待リンク自体は
-- 0069のコメント通り再利用可能な設計のため、この重複チェックが唯一の防御線となる。
--
-- protect_last_team_admin()(0114、trg_protect_last_team_admin)は
-- before update or delete on team_membershipsのみに設定されており、
-- INSERTには一切関与しない(0114のコメントに明記された既存の設計)。
-- 2件目以降の管理者追加は常にINSERTであるため、このtriggerとは無関係。
--
-- 本migrationはこの2関数のcreate or replaceのみが対象。DROP・シグネチャ変更は
-- 行わない。RLS policy・trigger・他のfunction・アプリコードには一切触れない。
-- create or replace functionはACL(EXECUTE権限)を変更しないため、GRANT文は不要
-- (ローカル実測で確認済み: 変更前後でACLが完全一致することを確認)。
--
-- Step2完了時点では、この2関数の新しい分岐(has_profile = true側)へは
-- どのUIからも到達できない(招待フローはsignUp()前提のまま、チーム追加作成UIも
-- 未実装のため)。実際に2件目以降のmembershipが作られ得るようになるのは
-- 段階3d-2 Step3(招待フローの3ケース対応・チーム追加作成UI)完了後。
--
-- ローカルverify0112での隔離検証(単一トランザクション、最終rollbackで無変更):
--   - 新規ユーザー回帰(profiles/team_memberships自動生成)PASS
--   - 既存1所属ユーザーの2校目作成(profiles不変、team_memberships 2行)PASS
--   - 既存2所属ユーザーの3校目作成(profiles不変、team_memberships 3行、上限なし)PASS
--   - 既存ユーザーが新チーム招待を承諾(profiles不変、team_memberships増加、
--     invites.used_at/used_by記録)PASS
--   - 既加入チームへの重複招待は明示例外で拒否 PASS
--   - Step2提案定義への変更後、関数変更前定義へrollbackした結果が、
--     関数定義md5・ACL・trigger状態・policy件数・データ件数のすべてで
--     baselineと完全一致することを確認 PASS

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
  has_profile boolean;
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
    insert into public.profiles (id, team_id, name, role, status)
      values (auth.uid(), new_team_id, admin_name, '管理者', 'アクティブ');
  end if;

  return new_team_id;
end;
$$;

create or replace function public.accept_invite(invite_token text, member_name text, player_ids uuid[] default '{}')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  member_email text;
  has_profile boolean;
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
    insert into public.profiles (id, team_id, name, role, status, email)
      values (auth.uid(), inv.team_id, member_name, inv.role, 'アクティブ', member_email);
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
