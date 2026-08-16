-- チーム日報(daily_reports)・コーチ日報(reports)に画像・資料を添付できるようにする。
-- notice_attachmentsと同じ構造(storage_path/file_name)だが、kindのような種別区分は持たない。
create table public.daily_report_attachments (
  id uuid primary key default gen_random_uuid(),
  daily_report_id uuid not null references public.daily_reports(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

create table public.report_attachments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

alter table public.daily_report_attachments enable row level security;
alter table public.report_attachments enable row level security;

-- daily_report_attachments: チーム日報本体と同じく全ロールが閲覧・登録・削除できる。
create policy daily_report_attachments_select on public.daily_report_attachments for select
  using (
    exists (
      select 1 from public.daily_reports r
      where r.id = daily_report_id and r.team_id = public.current_team_id()
    )
  );
create policy daily_report_attachments_insert on public.daily_report_attachments for insert
  with check (
    exists (
      select 1 from public.daily_reports r
      where r.id = daily_report_id
        and r.team_id = public.current_team_id()
        and public.current_role() in ('一般', '運営', '指導者', '管理者')
    )
  );
create policy daily_report_attachments_delete on public.daily_report_attachments for delete
  using (
    exists (
      select 1 from public.daily_reports r
      where r.id = daily_report_id
        and r.team_id = public.current_team_id()
        and public.current_role() in ('一般', '運営', '指導者', '管理者')
    )
  );

-- report_attachments: コーチ日報本体と同じく指導者・管理者のみ閲覧・登録・削除できる。
create policy report_attachments_select on public.report_attachments for select
  using (
    exists (
      select 1 from public.reports r
      where r.id = report_id
        and r.team_id = public.current_team_id()
        and public.current_role() in ('指導者', '管理者')
    )
  );
create policy report_attachments_insert on public.report_attachments for insert
  with check (
    exists (
      select 1 from public.reports r
      where r.id = report_id
        and r.team_id = public.current_team_id()
        and public.current_role() in ('指導者', '管理者')
    )
  );
create policy report_attachments_delete on public.report_attachments for delete
  using (
    exists (
      select 1 from public.reports r
      where r.id = report_id
        and r.team_id = public.current_team_id()
        and public.current_role() in ('指導者', '管理者')
    )
  );

insert into storage.buckets (id, name, public)
values
  ('daily-report-attachments', 'daily-report-attachments', false),
  ('report-attachments', 'report-attachments', false)
on conflict (id) do nothing;

create policy daily_report_attachments_storage_select on storage.objects for select
  using (
    bucket_id = 'daily-report-attachments'
    and (storage.foldername(name))[1] = public.current_team_id()::text
  );
create policy daily_report_attachments_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'daily-report-attachments'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and public.current_role() in ('一般', '運営', '指導者', '管理者')
  );
create policy daily_report_attachments_storage_delete on storage.objects for delete
  using (
    bucket_id = 'daily-report-attachments'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and public.current_role() in ('一般', '運営', '指導者', '管理者')
  );

create policy report_attachments_storage_select on storage.objects for select
  using (
    bucket_id = 'report-attachments'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and public.current_role() in ('指導者', '管理者')
  );
create policy report_attachments_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'report-attachments'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and public.current_role() in ('指導者', '管理者')
  );
create policy report_attachments_storage_delete on storage.objects for delete
  using (
    bucket_id = 'report-attachments'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and public.current_role() in ('指導者', '管理者')
  );
