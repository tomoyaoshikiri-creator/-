-- ライブラリにタイトル・カテゴリー分けを追加するため、0072の「ファイル単体」の構造を、
-- お知らせ・日報と同じ「本体(タイトル・カテゴリー) + 複数の添付ファイル」の形に作り直す。
-- 0072適用直後でまだ実データが入っていない前提でテーブルごと作り直す(storageバケット自体は0072のまま流用)。
drop table if exists public.library_files cascade;

create table public.library_categories (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (team_id, name)
);

create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  uploader_id uuid references public.profiles(id) on delete set null,
  category_id uuid references public.library_categories(id) on delete set null,
  title text not null,
  created_at timestamptz not null default now()
);
create index library_items_team_id_idx on public.library_items(team_id, created_at desc);

create table public.library_files (
  id uuid primary key default gen_random_uuid(),
  library_item_id uuid not null references public.library_items(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

alter table public.library_categories enable row level security;
alter table public.library_items enable row level security;
alter table public.library_files enable row level security;

create policy library_categories_select on public.library_categories for select
  using (team_id = public.current_team_id());
create policy library_categories_insert on public.library_categories for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('一般', '運営', '指導者', '管理者')
  );

create policy library_items_select on public.library_items for select
  using (team_id = public.current_team_id());
create policy library_items_insert on public.library_items for insert
  with check (
    team_id = public.current_team_id()
    and uploader_id = auth.uid()
    and public.current_role() in ('一般', '運営', '指導者', '管理者')
  );
create policy library_items_delete on public.library_items for delete
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('一般', '運営', '指導者', '管理者')
  );

create policy library_files_select on public.library_files for select
  using (
    exists (
      select 1 from public.library_items i
      where i.id = library_item_id and i.team_id = public.current_team_id()
    )
  );
create policy library_files_insert on public.library_files for insert
  with check (
    exists (
      select 1 from public.library_items i
      where i.id = library_item_id
        and i.team_id = public.current_team_id()
        and i.uploader_id = auth.uid()
    )
  );
create policy library_files_delete on public.library_files for delete
  using (
    exists (
      select 1 from public.library_items i
      where i.id = library_item_id and i.team_id = public.current_team_id()
    )
  );
