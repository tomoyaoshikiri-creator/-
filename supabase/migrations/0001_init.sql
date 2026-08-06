-- 都賀ビクトリーズ チーム運営アプリ 初期スキーマ
-- マルチテナント設計: 業務テーブルは全て team_id を持ち、RLSで自チームのデータのみに限定する。

create extension if not exists pgcrypto;

-- =========================================================
-- テーブル定義
-- =========================================================

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  role text not null default '一般' check (role in ('一般', '役員', '指導者', '管理者')),
  status text not null default 'アクティブ' check (status in ('アクティブ', '休止')),
  created_at timestamptz not null default now()
);
create index profiles_team_id_idx on public.profiles(team_id);

-- 招待リンク(保護者用=一般 / 指導者用=指導者)。役員以上が発行する。
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  role text not null check (role in ('一般', '指導者')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '30 days'),
  used_at timestamptz,
  used_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index invites_team_id_idx on public.invites(team_id);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  type text not null check (type in ('practice', 'game')),
  title text not null,
  date date not null,
  start_time time,
  end_time time,
  place text,
  toban text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index schedules_team_date_idx on public.schedules(team_id, date);

create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('出席', '欠席')),
  accompany text check (accompany in ('あり', 'なし')),
  accompany_count int,
  car text check (car in ('可', '不可')),
  seats int,
  note text,
  updated_at timestamptz not null default now(),
  unique (schedule_id, user_id)
);

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  body text,
  sender_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index notices_team_id_idx on public.notices(team_id, created_at desc);

create table public.notice_attachments (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices(id) on delete cascade,
  kind text not null check (kind in ('対戦表', '配車表', 'その他')),
  storage_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  author_id uuid references public.profiles(id),
  date_label text,
  body text not null,
  created_at timestamptz not null default now()
);
create index reports_team_id_idx on public.reports(team_id, created_at desc);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  sei text not null,
  mei text not null,
  sei_kana text,
  mei_kana text,
  grade text check (grade in ('0', '1', '2', '3', '4', '5', '6')),
  number text,
  positions text[] not null default '{}' check (positions <@ array['PG', 'SG', 'SF', 'PF', 'C']),
  status text not null default '在籍' check (status in ('在籍', '休部', '退団', 'OB・OG')),
  created_at timestamptz not null default now()
);
create index players_team_id_idx on public.players(team_id);

create table public.player_notes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  author_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index player_notes_player_id_idx on public.player_notes(player_id, created_at desc);

create table public.game_records (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  quarter int not null check (quarter between 1 and 4),
  starter_player_ids uuid[] not null default '{}'
    check (array_length(starter_player_ids, 1) is null or array_length(starter_player_ids, 1) <= 5),
  sub_player_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (schedule_id, quarter)
);

-- =========================================================
-- 権限ヘルパー関数(SECURITY DEFINER で profiles の RLS を経由せず参照し、再帰を避ける)
-- =========================================================

create or replace function public.current_team_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select team_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- =========================================================
-- チーム作成 / 招待受諾 RPC(いずれも SECURITY DEFINER、プロフィール未作成時のみ実行可)
-- =========================================================

create or replace function public.create_team_and_admin(team_name text, admin_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_team_id uuid;
begin
  if auth.uid() is null then
    raise exception '認証が必要です';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'このアカウントは既にチームに所属しています';
  end if;

  insert into public.teams (name) values (team_name) returning id into new_team_id;
  insert into public.profiles (id, team_id, name, role, status)
  values (auth.uid(), new_team_id, admin_name, '管理者', 'アクティブ');

  return new_team_id;
end;
$$;
grant execute on function public.create_team_and_admin(text, text) to authenticated;

create or replace function public.get_invite_info(invite_token text)
returns table(team_name text, role text, valid boolean)
language sql
security definer
stable
set search_path = public
as $$
  select t.name, i.role, (i.used_at is null and i.expires_at > now())
  from public.invites i
  join public.teams t on t.id = i.team_id
  where i.token = invite_token
$$;
grant execute on function public.get_invite_info(text) to anon, authenticated;

create or replace function public.accept_invite(invite_token text, member_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
begin
  if auth.uid() is null then
    raise exception '認証が必要です';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'このアカウントは既にチームに所属しています';
  end if;

  select * into inv from public.invites
    where token = invite_token and used_at is null and expires_at > now()
    for update;

  if not found then
    raise exception '招待リンクが無効か、有効期限が切れています';
  end if;

  insert into public.profiles (id, team_id, name, role, status)
  values (auth.uid(), inv.team_id, member_name, inv.role, 'アクティブ');

  update public.invites set used_at = now(), used_by = auth.uid() where id = inv.id;

  return inv.team_id;
end;
$$;
grant execute on function public.accept_invite(text, text) to authenticated;

-- 年度更新: 6年生は OB・OG へ、それ以外は学年+1(指導者・管理者のみ実行可)
create or replace function public.advance_academic_year()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid := public.current_team_id();
  rl text := public.current_role();
begin
  if tid is null or rl not in ('指導者', '管理者') then
    raise exception '権限がありません';
  end if;

  update public.players
    set status = 'OB・OG'
    where team_id = tid and status <> 'OB・OG' and grade = '6';

  update public.players
    set grade = (grade::int + 1)::text
    where team_id = tid and status <> 'OB・OG' and grade is not null and grade::int < 6;
end;
$$;
grant execute on function public.advance_academic_year() to authenticated;

-- =========================================================
-- 管理者保護トリガー: 管理者は削除不可 / 最後の1名は権限変更不可
-- =========================================================

create or replace function public.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.role = '管理者' then
      raise exception '管理者ユーザーは削除できません。先に権限を変更してください。';
    end if;
    return old;
  end if;

  if old.role = '管理者' and new.role <> '管理者' then
    if (select count(*) from public.profiles where team_id = old.team_id and role = '管理者') <= 1 then
      raise exception '管理者は最低1名必要です。';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_protect_last_admin
  before update or delete on public.profiles
  for each row execute function public.protect_last_admin();

-- =========================================================
-- Row Level Security
-- =========================================================

alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.schedules enable row level security;
alter table public.attendances enable row level security;
alter table public.notices enable row level security;
alter table public.notice_attachments enable row level security;
alter table public.reports enable row level security;
alter table public.players enable row level security;
alter table public.player_notes enable row level security;
alter table public.game_records enable row level security;

-- teams: 参照のみ(作成は RPC 経由)
create policy teams_select on public.teams for select
  using (id = public.current_team_id());

-- profiles: チーム内は全員参照可。更新・削除は管理者のみ(トリガーで最終防衛)。作成は RPC 経由のみ。
create policy profiles_select on public.profiles for select
  using (team_id = public.current_team_id());
create policy profiles_update_by_admin on public.profiles for update
  using (team_id = public.current_team_id() and public.current_role() = '管理者')
  with check (team_id = public.current_team_id());
create policy profiles_delete_by_admin on public.profiles for delete
  using (team_id = public.current_team_id() and public.current_role() = '管理者');

-- invites: 役員以上が発行・閲覧
create policy invites_select on public.invites for select
  using (team_id = public.current_team_id() and public.current_role() in ('役員', '指導者', '管理者'));
create policy invites_insert on public.invites for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('役員', '指導者', '管理者')
    and created_by = auth.uid()
  );

-- schedules: 全員閲覧、登録は役員以上
create policy schedules_select on public.schedules for select
  using (team_id = public.current_team_id());
create policy schedules_insert on public.schedules for insert
  with check (team_id = public.current_team_id() and public.current_role() in ('役員', '指導者', '管理者'));
create policy schedules_update on public.schedules for update
  using (team_id = public.current_team_id() and public.current_role() in ('役員', '指導者', '管理者'));
create policy schedules_delete on public.schedules for delete
  using (team_id = public.current_team_id() and public.current_role() in ('役員', '指導者', '管理者'));

-- attendances: チームメンバーは閲覧可、登録・更新は本人分のみ
create policy attendances_select on public.attendances for select
  using (exists (select 1 from public.schedules s where s.id = schedule_id and s.team_id = public.current_team_id()));
create policy attendances_insert on public.attendances for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.schedules s where s.id = schedule_id and s.team_id = public.current_team_id())
  );
create policy attendances_update on public.attendances for update
  using (user_id = auth.uid());

-- notices: 全員閲覧、登録は役員以上(発信者は自分自身)
create policy notices_select on public.notices for select
  using (team_id = public.current_team_id());
create policy notices_insert on public.notices for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('役員', '指導者', '管理者')
    and sender_id = auth.uid()
  );

create policy notice_attachments_select on public.notice_attachments for select
  using (exists (select 1 from public.notices n where n.id = notice_id and n.team_id = public.current_team_id()));
create policy notice_attachments_insert on public.notice_attachments for insert
  with check (
    exists (
      select 1 from public.notices n
      where n.id = notice_id and n.team_id = public.current_team_id() and n.sender_id = auth.uid()
    )
  );

-- reports: チーム全体で共有、登録は本人として全ロール可
create policy reports_select on public.reports for select
  using (team_id = public.current_team_id());
create policy reports_insert on public.reports for insert
  with check (team_id = public.current_team_id() and author_id = auth.uid());

-- players / player_notes / game_records: 指導者・管理者のみ
create policy players_select on public.players for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy players_insert on public.players for insert
  with check (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy players_update on public.players for update
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy players_delete on public.players for delete
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

create policy player_notes_select on public.player_notes for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy player_notes_insert on public.player_notes for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
    and author_id = auth.uid()
  );

create policy game_records_select on public.game_records for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy game_records_insert on public.game_records for insert
  with check (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy game_records_update on public.game_records for update
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

-- =========================================================
-- Storage: お知らせ添付資料 ({team_id}/{notice_id}/{filename})
-- =========================================================

insert into storage.buckets (id, name, public)
values ('notice-attachments', 'notice-attachments', false)
on conflict (id) do nothing;

create policy notice_attachments_storage_select on storage.objects for select
  using (
    bucket_id = 'notice-attachments'
    and (storage.foldername(name))[1] = public.current_team_id()::text
  );

create policy notice_attachments_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'notice-attachments'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and public.current_role() in ('役員', '指導者', '管理者')
  );
