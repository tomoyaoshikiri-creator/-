begin;

-- 複数チーム所属基盤 段階3a: switch_active_team() RPCの新設(DB互換レイヤーの追加のみ)。
-- このRPCはまだどこからも呼び出されない(アプリコードは段階3b/3cまで無変更)。
-- 既存のテーブル・トリガー・RLS・current_team_id()/current_role()・他RPCには
-- 一切触れない。

create or replace function public.switch_active_team(target_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_affected_rows int;
begin
  if auth.uid() is null then
    raise exception '認証されていません。';
  end if;

  if not exists (
    select 1 from public.team_memberships
    where user_id = auth.uid()
      and team_id = target_team_id
      and status = 'アクティブ'
  ) then
    raise exception '指定されたチームへのアクティブな所属が確認できません。';
  end if;

  v_session_id := case
    when auth.jwt() ->> 'session_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then (auth.jwt() ->> 'session_id')::uuid
    else null
  end;

  if v_session_id is null then
    raise exception 'セッション情報(session_id)を取得できませんでした。';
  end if;

  -- session_idは1つのSupabase Authセッションを一意に識別する値であるため、
  -- 既存行のuser_idを別のuser_idで上書きすることはしない。所有者確認と
  -- 書き込みをこのINSERT文自体で原子的に行う(WHERE句がfalseならDO UPDATEは
  -- 発生せず0行のまま=TOCTOUの隙間がない)。
  insert into public.active_team_sessions (session_id, user_id, team_id, updated_at)
  values (v_session_id, auth.uid(), target_team_id, now())
  on conflict (session_id) do update
    set team_id = excluded.team_id,
        updated_at = now()
    where public.active_team_sessions.user_id = excluded.user_id;

  get diagnostics v_affected_rows = row_count;

  if v_affected_rows <> 1 then
    raise exception 'セッション情報の整合性を確認できません。';
  end if;

  update public.profiles set last_team_id = target_team_id where id = auth.uid();
end;
$$;

revoke all on function public.switch_active_team(uuid) from public;
grant execute on function public.switch_active_team(uuid) to authenticated;

commit;
