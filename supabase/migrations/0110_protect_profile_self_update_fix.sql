begin;

-- protect_profile_self_update()のNULL問題修正。
-- current_role()がNULLを返す場合(段階3cでcurrent_team_id()/current_role()を
-- active_team_sessions依存へ切り替えた際、session_id欠落/不正・
-- active_team_sessions行なし・membership消失等でNULLになりうる)、
-- 従来の "<> '管理者'" はPostgresの3値論理でNULLとなり、PL/pgSQLのIFは
-- NULLをFALSE扱いするためガード本体がスキップされ、一般ユーザーが自分自身の
-- role/status/team_idを書き換えられてしまう(実際にローカルDBで再現確認済み)。
-- "IS DISTINCT FROM"へ変更し、NULLの場合も確実にガードが働くようにする
-- (current_role()が非NULLの場合の挙動は<>と完全に同一)。

create or replace function public.protect_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() is distinct from '管理者' then
    if new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.team_id is distinct from old.team_id then
      raise exception '自分の権限・ステータス・所属チームは変更できません。';
    end if;
  end if;
  return new;
end;
$$;

commit;
