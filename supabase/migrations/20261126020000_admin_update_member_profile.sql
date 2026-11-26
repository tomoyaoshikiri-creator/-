-- 管理者がユーザー管理画面から、他メンバーの表示名・誕生日を直接編集できるようにする
-- (ユーザー指示: 恒久的な機能として追加)。update_team_member()と同じ方針
-- (SECURITY DEFINER・管理者ロール必須・対象が自チームメンバーであることを確認)。
-- 個人情報の変更のため監査ログにも記録する。

alter table public.audit_logs drop constraint audit_logs_action_check;
alter table public.audit_logs add constraint audit_logs_action_check check (
  action = any (array[
    'role_changed', 'invite_issued', 'invite_revoked', 'member_removed',
    'team_leave', 'team_deletion_requested', 'ai_analysis_generated',
    'billing_plan_changed', 'billing_subscription_canceled', 'data_export',
    'players_bulk_imported', 'poll_voter_identity_viewed',
    'member_profile_edited'
  ])
);

create or replace function public.admin_update_member_profile(
  target_user_id uuid,
  new_name text default null,
  new_birthday date default null,
  clear_birthday boolean default false
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_team_id uuid;
  v_old_name text;
  v_old_birthday date;
  v_changed_fields text[] := '{}';
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
  if not exists (
    select 1 from public.team_memberships
    where user_id = target_user_id and team_id = v_team_id
  ) then
    raise exception '対象のメンバーが見つかりません';
  end if;
  if new_name is not null and btrim(new_name) = '' then
    raise exception '表示名を入力してください';
  end if;

  select name, birthday into v_old_name, v_old_birthday from public.profiles where id = target_user_id;

  if new_name is not null and new_name is distinct from v_old_name then
    v_changed_fields := array_append(v_changed_fields, 'name');
  end if;
  if (clear_birthday and v_old_birthday is not null)
     or (not clear_birthday and new_birthday is not null and new_birthday is distinct from v_old_birthday) then
    v_changed_fields := array_append(v_changed_fields, 'birthday');
  end if;

  update public.profiles
    set name = coalesce(new_name, name),
        birthday = case when clear_birthday then null else coalesce(new_birthday, birthday) end
    where id = target_user_id;

  if array_length(v_changed_fields, 1) > 0 then
    perform public.record_audit_event(
      v_team_id, 'member_profile_edited', 'profile', target_user_id,
      jsonb_build_object('target_name', coalesce(new_name, v_old_name), 'fields', v_changed_fields)
    );
  end if;
end;
$$;
