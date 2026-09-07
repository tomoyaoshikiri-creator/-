begin;

-- 検定のランク昇格に承認フローを追加する。
-- 級(kyu)の昇格: 保護者(一般・運営)が申請すると即座にplayer_skill_test_progressへ反映される
--   (これまで通りの挙動)が、指定した指導者・管理者への「事後承認」待ちレコードも作る。
--   却下された場合、そのランクは「現在のランク」の判定から除外される(過去ログは消さない)。
-- 段(dan)の昇格: 保護者が申請しても、指定した指導者・管理者が承認するまで
--   player_skill_test_progressには反映されない(ブロッキング)。
-- 指導者・管理者が自分で編集する場合はこの申請フローを経由しない(直接insertのまま)。

create table public.skill_test_promotion_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  skill_test_id uuid not null references public.skill_tests(id) on delete cascade,
  target_level_index int not null check (target_level_index >= 0),
  target_level_label text not null,
  -- true=段への昇格(承認されるまでprogressに反映しない)、false=級の昇格(即時反映+事後承認)。
  is_dan boolean not null,
  -- 級の場合のみ、即時反映したplayer_skill_test_progress行を申請側(クライアント)が指定する。
  -- 段の場合は承認時にDBトリガーが行を作るため、当初はnullのまま。
  progress_id uuid references public.player_skill_test_progress(id) on delete set null,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  -- 申請者が指定した承認者(指導者・管理者のうち1名)。この人だけが承認・却下できる
  -- (他のスタッフは一覧を見られるが操作はできない)。
  approver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index skill_test_promotion_requests_player_idx
  on public.skill_test_promotion_requests(player_id, skill_test_id, created_at desc);
create index skill_test_promotion_requests_team_status_idx
  on public.skill_test_promotion_requests(team_id, status);

alter table public.skill_test_promotion_requests enable row level security;

-- 閲覧: スタッフ全員(承認キューとして誰でも見られる。操作は承認者本人のみ) + 申請者本人。
create policy skill_test_promotion_requests_select on public.skill_test_promotion_requests for select
  using (
    team_id = public.current_team_id()
    and (
      public.current_role() in ('指導者', '管理者')
      or requested_by = auth.uid()
    )
  );

-- 申請: 一般・運営が、自分に紐づく選手について、指導者・管理者を1名承認者に指定して行う。
create policy skill_test_promotion_requests_insert on public.skill_test_promotion_requests for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('一般', '運営')
    and requested_by = auth.uid()
    and status = 'pending'
    and decided_by is null
    and decided_at is null
    and exists (
      select 1 from public.player_guardians pg
      where pg.player_id = skill_test_promotion_requests.player_id and pg.profile_id = auth.uid()
    )
    and exists (
      select 1 from public.team_memberships tm
      where tm.team_id = skill_test_promotion_requests.team_id
        and tm.user_id = skill_test_promotion_requests.approver_id
        and tm.role in ('指導者', '管理者')
    )
  );

-- 承認・却下: 申請時に指定された承認者本人のみ、pending中のものに対して行える。
create policy skill_test_promotion_requests_update on public.skill_test_promotion_requests for update
  using (
    team_id = public.current_team_id()
    and approver_id = auth.uid()
    and public.current_role() in ('指導者', '管理者')
    and status = 'pending'
  )
  with check (team_id = public.current_team_id());

-- 承認者以外のフィールドが書き換えられないよう保護し、決定者・決定日時はサーバー側で設定する。
create or replace function public.protect_skill_test_promotion_request_columns()
returns trigger
language plpgsql
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
  new.approver_id := old.approver_id;
  new.created_at := old.created_at;
  if new.status not in ('approved', 'rejected') then
    raise exception '承認または却下のみ行えます';
  end if;
  new.decided_by := auth.uid();
  new.decided_at := now();
  return new;
end;
$$;

create trigger protect_skill_test_promotion_request_columns_trigger
before update on public.skill_test_promotion_requests
for each row execute function public.protect_skill_test_promotion_request_columns();

-- 段への昇格が承認されたら、player_skill_test_progressへ自動的に記録を追加する
-- (級は保護者側クライアントが申請と同時に直接insertしているため対象外)。
-- 承認者は指導者・管理者本人であり、player_skill_test_progress_insertのRLSは
-- 指導者・管理者による任意選手への記録追加を既に許可しているため、
-- security definerにせず承認者自身の権限のまま実行する。
create or replace function public.apply_approved_skill_test_promotion()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'approved' and old.status = 'pending' and new.is_dan then
    insert into public.player_skill_test_progress (team_id, player_id, skill_test_id, level_index, recorded_by)
    values (new.team_id, new.player_id, new.skill_test_id, new.target_level_index, new.decided_by);
  end if;
  return new;
end;
$$;

create trigger apply_approved_skill_test_promotion_trigger
after update on public.skill_test_promotion_requests
for each row execute function public.apply_approved_skill_test_promotion();

commit;
