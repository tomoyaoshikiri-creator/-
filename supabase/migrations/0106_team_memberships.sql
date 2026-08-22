begin;

-- 複数チーム所属基盤 段階1: team_memberships / active_team_sessions の新設とbackfillのみを行う。
-- profiles.team_id/role/status・current_team_id()/current_role()・protect_last_admin・
-- create_team_and_admin・accept_invite・既存RLS/Storage policy・SEC-02トリガー・
-- API Route・UI・招待フロー・setup・Stripe・AI分析は一切変更しない。
-- 適用直後もアプリは従来通りprofiles.team_id/roleで完全に同一の動作を続ける。

-- 0) 事前検査: 現行のNOT NULL/CHECK/FK制約により理論上発生し得ないはずだが、
--    fail closedのため実データで確認してから進める。
do $$
declare
  v_null_team_id int;
  v_invalid_role int;
  v_invalid_status int;
  v_orphan_team int;
begin
  select count(*) into v_null_team_id from public.profiles where team_id is null;
  select count(*) into v_invalid_role from public.profiles where role not in ('一般','運営','指導者','管理者');
  select count(*) into v_invalid_status from public.profiles where status not in ('アクティブ','休止');
  select count(*) into v_orphan_team from public.profiles p
    where not exists (select 1 from public.teams t where t.id = p.team_id);

  if v_null_team_id > 0 or v_invalid_role > 0 or v_invalid_status > 0 or v_orphan_team > 0 then
    raise exception
      'profiles異常データ検出のためmigrationを中止します: null_team_id=%, invalid_role=%, invalid_status=%, orphan_team=%',
      v_null_team_id, v_invalid_role, v_invalid_status, v_orphan_team;
  end if;
end $$;

-- 1) team_memberships新設
create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  role text not null default '一般' check (role in ('一般','運営','指導者','管理者')),
  status text not null default 'アクティブ' check (status in ('アクティブ','休止')),
  joined_at timestamptz not null default now(),
  unique (user_id, team_id)
);
create index team_memberships_team_id_idx on public.team_memberships(team_id);

alter table public.team_memberships enable row level security;
-- 段階1ではpolicyを一切作らない(authenticated/anonからは不可視・書込不可)。
-- 実際に使い始める段階3で、既存profilesのRLSに相当するpolicyを追加する。

-- 2) active_team_sessions新設
create table public.active_team_sessions (
  session_id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.active_team_sessions enable row level security;
-- switch_active_team()がまだ存在しないため、policyを一切作らない
-- (authenticated/anonからは不可視・書込不可)。

-- 3) profiles.last_team_id新設
alter table public.profiles
  add column last_team_id uuid references public.teams(id) on delete set null;
-- RLS/権限境界には使用しない、UX上の初期値ヒント専用の列。

-- 4) backfill: team_memberships
insert into public.team_memberships (user_id, team_id, role, status, joined_at)
select id, team_id, role, status, created_at
from public.profiles;

-- 5) backfill: profiles.last_team_id(現時点では1人1チームのため、そのまま反映する)
update public.profiles set last_team_id = team_id;

commit;
