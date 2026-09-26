-- P-1(0154)のCI失敗調査で発覚した発見への対応。
--
-- notice_attachments/daily_report_attachments/report_attachmentsの3テーブルには、
-- マイグレーション履歴に一切記録されていない関数・トリガーが本番に存在していた
-- (過去にマイグレーションを経由せず直接作成されたドリフト)。中身を確認したところ、
-- 単なる重複ではなく、0140の汎用関数enforce_attachment_storage_limit()にはない
-- 重要な検証を行っていた:
--   1. アップロード先(notice/daily_report/report)が自チーム(current_team_id())の
--      ものであることの確認(他チームの行への添付を防ぐ、テナント分離)
--   2. storage.objectsの実ファイルサイズをnew.size_bytesへ強制的に採用
--      (クライアントが送ってきた値を信用しない、サーバー側検証)
-- このマイグレーションでは、既に本番に存在するこれら4関数の定義を
-- そのまま(pg_get_functiondefで採取した現状の定義通りに)再現し、
-- 今後のマイグレーション履歴・フレッシュ環境の再生に含まれるようにする。
--
-- 加えて、library_filesだけは関数enforce_library_files_storage_limit()が
-- 存在するのにトリガーとして一度も配線されておらず、上記1・2の保護を
-- 受けていなかった(他の3テーブルとの非対称)。このマイグレーションで
-- 他の3テーブルと同じ命名規則のトリガーを新設し、対称にする。

create or replace function public.enforce_notice_attachments_storage_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  row_team_id uuid;
  limit_bytes bigint;
  current_usage bigint;
  actual_size bigint;
begin
  select team_id into row_team_id
  from public.notices
  where id = new.notice_id;

  if row_team_id is null or row_team_id is distinct from public.current_team_id() then
    raise exception 'アップロード先チームが正しく確認できません';
  end if;

  select (o.metadata->>'size')::bigint into actual_size
  from storage.objects o
  where o.bucket_id = 'notice-attachments' and o.name = new.storage_path;

  if actual_size is null then
    raise exception 'アップロードされたファイルが見つかりません。もう一度お試しください';
  end if;

  new.size_bytes := actual_size;

  select storage_limit_bytes into limit_bytes from public.teams where id = row_team_id;
  current_usage := public.team_storage_usage_bytes();
  if limit_bytes is not null and current_usage + new.size_bytes > limit_bytes then
    raise exception 'ストレージ容量の上限を超えるため保存できません';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_daily_report_attachments_storage_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  row_team_id uuid;
  limit_bytes bigint;
  current_usage bigint;
  actual_size bigint;
begin
  select team_id into row_team_id
  from public.daily_reports
  where id = new.daily_report_id;

  if row_team_id is null or row_team_id is distinct from public.current_team_id() then
    raise exception 'アップロード先チームが正しく確認できません';
  end if;

  select (o.metadata->>'size')::bigint into actual_size
  from storage.objects o
  where o.bucket_id = 'daily-report-attachments' and o.name = new.storage_path;

  if actual_size is null then
    raise exception 'アップロードされたファイルが見つかりません。もう一度お試しください';
  end if;

  new.size_bytes := actual_size;

  select storage_limit_bytes into limit_bytes from public.teams where id = row_team_id;
  current_usage := public.team_storage_usage_bytes();
  if limit_bytes is not null and current_usage + new.size_bytes > limit_bytes then
    raise exception 'ストレージ容量の上限を超えるため保存できません';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_report_attachments_storage_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  row_team_id uuid;
  limit_bytes bigint;
  current_usage bigint;
  actual_size bigint;
begin
  select team_id into row_team_id
  from public.reports
  where id = new.report_id;

  if row_team_id is null or row_team_id is distinct from public.current_team_id() then
    raise exception 'アップロード先チームが正しく確認できません';
  end if;

  select (o.metadata->>'size')::bigint into actual_size
  from storage.objects o
  where o.bucket_id = 'report-attachments' and o.name = new.storage_path;

  if actual_size is null then
    raise exception 'アップロードされたファイルが見つかりません。もう一度お試しください';
  end if;

  new.size_bytes := actual_size;

  select storage_limit_bytes into limit_bytes from public.teams where id = row_team_id;
  current_usage := public.team_storage_usage_bytes();
  if limit_bytes is not null and current_usage + new.size_bytes > limit_bytes then
    raise exception 'ストレージ容量の上限を超えるため保存できません';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_library_files_storage_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  row_team_id uuid;
  limit_bytes bigint;
  current_usage bigint;
  actual_size bigint;
begin
  select team_id into row_team_id
  from public.library_items
  where id = new.library_item_id;

  if row_team_id is null or row_team_id is distinct from public.current_team_id() then
    raise exception 'アップロード先チームが正しく確認できません';
  end if;

  select (o.metadata->>'size')::bigint into actual_size
  from storage.objects o
  where o.bucket_id = 'library-files' and o.name = new.storage_path;

  if actual_size is null then
    raise exception 'アップロードされたファイルが見つかりません。もう一度お試しください';
  end if;

  new.size_bytes := actual_size;

  select storage_limit_bytes into limit_bytes from public.teams where id = row_team_id;
  current_usage := public.team_storage_usage_bytes();
  if limit_bytes is not null and current_usage + new.size_bytes > limit_bytes then
    raise exception 'ストレージ容量の上限を超えるため保存できません';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_notice_attachments_storage_limit_trigger on public.notice_attachments;
create trigger enforce_notice_attachments_storage_limit_trigger
  before insert on public.notice_attachments
  for each row execute function public.enforce_notice_attachments_storage_limit();

drop trigger if exists enforce_daily_report_attachments_storage_limit_trigger on public.daily_report_attachments;
create trigger enforce_daily_report_attachments_storage_limit_trigger
  before insert on public.daily_report_attachments
  for each row execute function public.enforce_daily_report_attachments_storage_limit();

drop trigger if exists enforce_report_attachments_storage_limit_trigger on public.report_attachments;
create trigger enforce_report_attachments_storage_limit_trigger
  before insert on public.report_attachments
  for each row execute function public.enforce_report_attachments_storage_limit();

-- library_filesはこれまで未配線だった箇所(今回の変更点)。
drop trigger if exists enforce_library_files_storage_limit_trigger on public.library_files;
create trigger enforce_library_files_storage_limit_trigger
  before insert on public.library_files
  for each row execute function public.enforce_library_files_storage_limit();
