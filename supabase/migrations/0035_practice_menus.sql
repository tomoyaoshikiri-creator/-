-- 練習(schedules.type='practice')に紐づく練習メニュー(テーマ・内容)を1件だけ持たせる。
-- 予定と1:1のため、schedule_idを一意制約にして「無ければ作成、あれば更新」の単純な形にする。
create table public.practice_menus (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  theme text,
  content text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (schedule_id)
);

alter table public.practice_menus enable row level security;

-- 閲覧は予定と同じく全ロールに開放する(絞りたくなったら後で narrow にする)。
create policy practice_menus_select on public.practice_menus for select
  using (team_id = public.current_team_id());

create policy practice_menus_insert on public.practice_menus for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
  );

create policy practice_menus_update on public.practice_menus for update
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'))
  with check (team_id = public.current_team_id());

create policy practice_menus_delete on public.practice_menus for delete
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
