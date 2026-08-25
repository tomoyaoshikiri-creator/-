begin;

-- 複数チーム所属基盤 段階3c。current_team_id()/current_role()の導出元を
-- profiles.team_id/profiles.roleから、session_idキーのactive_team_sessions +
-- team_memberships経由へ切り替える。シグネチャ(引数なし、戻り値型)は変更せず、
-- 依存する全RLSポリシー・関数の呼び出し側コードは無変更で動作する。
--
-- fail-closed設計: session_id欠落・不正・active_team_sessions行なし・
-- ats.user_idとauth.uid()の不一致・membership消失のいずれの場合もNULLを返す
-- (自動フォールバックしない)。status='休止'は参照しない(アクセス制御に使わない)。
-- 0110・0111で、current_role()/current_team_id()の戻り値がNULLになりうることに
-- 対する既知の依存箇所(NOT IN・<>によるフェイルオープン)は修正済み。
-- Bootstrap前提となる/setup・/signupの直接profiles参照も別途修正済み。

create or replace function public.current_team_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tm.team_id
  from public.active_team_sessions ats
  join public.team_memberships tm
    on tm.user_id = ats.user_id and tm.team_id = ats.team_id
  where ats.session_id = (
    case
      when (auth.jwt() ->> 'session_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then (auth.jwt() ->> 'session_id')::uuid
      else null
    end
  )
  and ats.user_id = auth.uid()
$$;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select tm.role
  from public.team_memberships tm
  where tm.team_id = public.current_team_id()
    and tm.user_id = auth.uid()
$$;

commit;
