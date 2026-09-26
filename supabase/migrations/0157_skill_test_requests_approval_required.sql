begin;

-- 検定のランク反映を、級・段を問わず必ず指導者・管理者の承認を経てから行うようにする。
-- これまでは (1) 指導者・管理者が自分で編集する場合は申請フローを経由せず直接反映、
-- (2) 保護者からの級の申請は即時反映+事後承認、という2つの「承認前に反映される」経路が
-- あったが、いずれも廃止し、すべてskill_test_promotion_requestsの承認(pending→approved)
-- を経て初めてplayer_skill_test_progressへ反映される一本の経路にする。
--
-- あわせて、承認者を申請時に1名だけ指定する方式(approver_id)をやめ、指導者・管理者で
-- あれば誰でも承認待ちキューから承認・却下できる方式に変更する(指導者が1人しかいない
-- チームでも運用できるようにするため)。

-- player_skill_test_progressへの直接insertを禁止する(以後はapply_approved_skill_test_promotion
-- トリガー経由のみが行として作られる)。RLSはデフォルト拒否のため、insertポリシーを削除するだけでよい。
drop policy if exists player_skill_test_progress_insert on public.player_skill_test_progress;

-- approver_idを申請時に必須で指定する方式を廃止する。
alter table public.skill_test_promotion_requests drop column approver_id;

-- 申請: 一般・運営は自分に紐づく選手について、指導者・管理者は任意の選手について申請できる。
drop policy if exists skill_test_promotion_requests_insert on public.skill_test_promotion_requests;
create policy skill_test_promotion_requests_insert on public.skill_test_promotion_requests for insert
  with check (
    team_id = public.current_team_id()
    and requested_by = auth.uid()
    and status = 'pending'
    and decided_by is null
    and decided_at is null
    and (
      public.current_role() in ('指導者', '管理者')
      or (
        public.current_role() in ('一般', '運営')
        and exists (
          select 1 from public.player_guardians pg
          where pg.player_id = skill_test_promotion_requests.player_id and pg.profile_id = auth.uid()
        )
      )
    )
  );

-- 承認・却下: 指導者・管理者であれば誰でも、pending中のものに対して行える
-- (自分自身が申請したものを自分で承認することも許容する。1人体制のチームでも運用できるように)。
drop policy if exists skill_test_promotion_requests_update on public.skill_test_promotion_requests;
create policy skill_test_promotion_requests_update on public.skill_test_promotion_requests for update
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
    and status = 'pending'
  )
  with check (team_id = public.current_team_id());

-- approver_id列を参照していた保護トリガーを更新する。
create or replace function public.protect_skill_test_promotion_request_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.team_id := old.team_id;
  new.player_id := old.player_id;
  new.skill_test_id := old.skill_test_id;
  new.target_level_index := old.target_level_index;
  new.target_level_label := old.target_level_label;
  new.is_dan := old.is_dan;
  new.progress_id := old.progress_id;
  new.requested_by := old.requested_by;
  new.created_at := old.created_at;
  if new.status not in ('approved', 'rejected') then
    raise exception '承認または却下のみ行えます';
  end if;
  new.decided_by := auth.uid();
  new.decided_at := now();
  return new;
end;
$$;

-- 承認されたら級・段を問わずplayer_skill_test_progressへ記録を追加する。player_skill_test_progress
-- 側の直接insertポリシーを廃止したため、このトリガーはsecurity definerで実行し、RLSを介さず
-- 記録できるようにする(承認操作自体は上記updateポリシーで指導者・管理者に限定済み)。
create or replace function public.apply_approved_skill_test_promotion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    insert into public.player_skill_test_progress (team_id, player_id, skill_test_id, level_index, recorded_by)
    values (new.team_id, new.player_id, new.skill_test_id, new.target_level_index, new.decided_by);
  end if;
  return new;
end;
$$;

commit;
