-- 本人による自分自身のプロフィール編集(表示名の変更)を許可する。
-- 権限(role)・ステータス(status)・所属チーム(team_id)は引き続き管理者のみが変更できるよう、
-- トリガーで本人更新時にこれらの列の変更を拒否する(RLSポリシー自体は行単位のため列単位のガードはトリガーで行う)。

create policy profiles_update_self on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.protect_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() <> '管理者' then
    if new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.team_id is distinct from old.team_id then
      raise exception '自分の権限・ステータス・所属チームは変更できません。';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_protect_profile_self_update
  before update on public.profiles
  for each row execute function public.protect_profile_self_update();
