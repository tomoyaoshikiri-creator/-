begin;

-- 監査ログ(B-3)。ロール変更・招待発行/取消・メンバー削除・チーム退会・AI生成・
-- 課金操作を記録し、管理者が閲覧できるようにする。

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  -- システム(Stripe Webhook等)発の記録はactor_id NULLとして扱う。
  action text not null check (action in (
    'role_changed',
    'invite_issued',
    'invite_revoked',
    'member_removed',
    'team_leave',
    'team_deletion_requested',
    'ai_analysis_generated',
    'billing_plan_changed',
    'billing_subscription_canceled',
    'data_export'
  )),
  -- target_type/target_idは対象の種類によって指すテーブルが変わる(polymorphic)ため、
  -- 特定テーブルへのFKは張らない。対象行が後で削除されても文脈が残るよう、
  -- 表示に必要な情報はdetailにスナップショットとして持たせる。
  target_type text,
  target_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_team_id_created_at_idx on public.audit_logs(team_id, created_at desc);

alter table public.audit_logs enable row level security;

-- 閲覧は自チームの管理者のみ。書き込みはこのファイル内のSECURITY DEFINER関数
-- (record_audit_event、既存RPC内部からのみ呼ばれる)またはservice_roleクライアント
-- 経由に限定し、authenticated/anonへのINSERT/UPDATE/DELETE権限は一切付与しない
-- (クライアントが自分に都合よく改ざん・捏造できないようにするため)。
create policy audit_logs_select on public.audit_logs for select
  using (team_id = public.current_team_id() and public.current_role() = '管理者');

-- record_audit_event(): 監査ログの記録用ヘルパー。authenticated/anonへは
-- EXECUTE権限を付与しない(直接呼べるとクライアントが任意の偽イベントを記録できて
-- しまうため)。update_team_member/remove_team_member等のSECURITY DEFINER関数や
-- トリガーの内部からのみ呼ぶ想定(呼び出し元がSECURITY DEFINERであれば、その
-- 関数オーナーの権限でrecord_audit_event自体も実行できる)。
create or replace function public.record_audit_event(
  p_team_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_detail jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (team_id, actor_id, action, target_type, target_id, detail)
  values (p_team_id, auth.uid(), p_action, p_target_type, p_target_id, p_detail);
end;
$$;
revoke execute on function public.record_audit_event(uuid, text, text, uuid, jsonb) from public;

-- update_team_member()を再定義し、role実変更時にrole_changedを記録する(0114の再定義)。
-- ロジック自体は変更しない(対象未存在チェックの実装をexistsからselect into+not foundに
-- 変えているが、挙動は同一)。
create or replace function public.update_team_member(
  target_user_id uuid,
  new_role text default null,
  new_status text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_old_role text;
begin
  if auth.uid() is null then
    raise exception '認証されていません。';
  end if;
  v_team_id := public.current_team_id();
  if v_team_id is null then
    raise exception 'セッション情報を取得できませんでした。';
  end if;
  if public.current_role() is distinct from '管理者' then
    raise exception '権限がありません';
  end if;
  if target_user_id is null then
    raise exception '対象を指定してください';
  end if;
  select role into v_old_role
    from public.team_memberships
    where user_id = target_user_id and team_id = v_team_id;
  if not found then
    raise exception '対象のメンバーが見つかりません';
  end if;
  if new_role is not null and new_role not in ('一般', '運営', '指導者', '管理者') then
    raise exception '不正なroleです: %', new_role;
  end if;
  if new_status is not null and new_status not in ('アクティブ', '休止') then
    raise exception '不正なstatusです: %', new_status;
  end if;

  update public.team_memberships
    set role = coalesce(new_role, role),
        status = coalesce(new_status, status)
    where user_id = target_user_id and team_id = v_team_id;

  if new_role is not null and new_role is distinct from v_old_role then
    perform public.record_audit_event(
      v_team_id, 'role_changed', 'team_membership', target_user_id,
      jsonb_build_object('from_role', v_old_role, 'to_role', new_role)
    );
  end if;
end;
$$;

-- remove_team_member()を再定義し、削除前にmember_removedを記録する(0119の再定義。
-- player_guardians削除ロジック自体は変更しない)。
create or replace function public.remove_team_member(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_team_id uuid;
  v_target_name text;
begin
  if auth.uid() is null then
    raise exception '認証されていません。';
  end if;

  v_team_id := public.current_team_id();
  if v_team_id is null then
    raise exception 'セッション情報を取得できませんでした。';
  end if;
  if public.current_role() is distinct from '管理者' then
    raise exception '権限がありません';
  end if;
  if target_user_id is null then
    raise exception '対象を指定してください';
  end if;
  if target_user_id = auth.uid() then
    raise exception '自分自身は削除できません';
  end if;
  if not exists (
    select 1 from public.team_memberships
    where user_id = target_user_id and team_id = v_team_id
  ) then
    raise exception '対象のメンバーが見つかりません';
  end if;

  select name into v_target_name from public.profiles where id = target_user_id;

  delete from public.player_guardians
    where profile_id = target_user_id and team_id = v_team_id;

  delete from public.team_memberships
    where user_id = target_user_id and team_id = v_team_id;

  delete from public.active_team_sessions
    where user_id = target_user_id and team_id = v_team_id;

  perform public.record_audit_event(
    v_team_id, 'member_removed', 'team_membership', target_user_id,
    jsonb_build_object('target_name', v_target_name)
  );
end;
$func$;

-- 招待の発行・取消は専用RPCを持たず(クライアントからinvitesへ直接insert/delete、
-- 既存RLSで権限制御)、フックできる関数がないためトリガーで記録する。
-- 受諾(accept_invite)はused_atを更新するだけでinvites行を削除しないため、
-- AFTER DELETEはtrg_protect_last_team_admin同様「取消」操作にのみ発火する。
create or replace function public.log_invite_issued()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.record_audit_event(
    new.team_id, 'invite_issued', 'invite', new.id,
    jsonb_build_object('role', new.role)
  );
  return new;
end;
$$;
create trigger trg_log_invite_issued
  after insert on public.invites
  for each row execute function public.log_invite_issued();

create or replace function public.log_invite_revoked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.used_at is null then
    perform public.record_audit_event(
      old.team_id, 'invite_revoked', 'invite', old.id,
      jsonb_build_object('role', old.role)
    );
  end if;
  return old;
end;
$$;
create trigger trg_log_invite_revoked
  after delete on public.invites
  for each row execute function public.log_invite_revoked();

commit;
