-- 「ライブラリ」タブ: チームで共有したい画像・資料を置いておく専用の置き場。
-- お知らせ・日報のような特定の投稿に紐づく添付ではなく、独立したファイル一覧として扱う。
create table public.library_files (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  uploader_id uuid references public.profiles(id) on delete set null,
  storage_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);
create index library_files_team_id_idx on public.library_files(team_id, created_at desc);

alter table public.library_files enable row level security;

create policy library_files_select on public.library_files for select
  using (team_id = public.current_team_id());
create policy library_files_insert on public.library_files for insert
  with check (
    team_id = public.current_team_id()
    and uploader_id = auth.uid()
    and public.current_role() in ('一般', '運営', '指導者', '管理者')
  );
create policy library_files_delete on public.library_files for delete
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('一般', '運営', '指導者', '管理者')
  );

insert into storage.buckets (id, name, public)
values ('library-files', 'library-files', false)
on conflict (id) do nothing;

create policy library_files_storage_select on storage.objects for select
  using (
    bucket_id = 'library-files'
    and (storage.foldername(name))[1] = public.current_team_id()::text
  );
create policy library_files_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'library-files'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and public.current_role() in ('一般', '運営', '指導者', '管理者')
  );
create policy library_files_storage_delete on storage.objects for delete
  using (
    bucket_id = 'library-files'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and public.current_role() in ('一般', '運営', '指導者', '管理者')
  );
