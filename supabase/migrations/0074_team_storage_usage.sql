-- チームごとのストレージ使用量を追跡・表示できるようにする。
-- 添付ファイル系の各テーブルにsize_bytesを持たせ、アップロード時にアプリ側から記録する。
-- 上限(storage_limit_bytes)はteamsに持たせ、まずは全チーム共通で2GiBを既定値とする
-- (将来プランを分ける場合もこの列を個別に更新するだけで対応できる)。

alter table public.notice_attachments add column size_bytes bigint not null default 0;
alter table public.daily_report_attachments add column size_bytes bigint not null default 0;
alter table public.report_attachments add column size_bytes bigint not null default 0;
alter table public.library_files add column size_bytes bigint not null default 0;

alter table public.teams add column storage_limit_bytes bigint not null default 2147483648; -- 2GiB

-- 既存データの実サイズをstorage.objectsのメタデータから逆引きして埋める(新規は今後アプリ側で記録)。
update public.notice_attachments na
set size_bytes = coalesce((o.metadata->>'size')::bigint, 0)
from storage.objects o
where o.bucket_id = 'notice-attachments' and o.name = na.storage_path;

update public.daily_report_attachments dra
set size_bytes = coalesce((o.metadata->>'size')::bigint, 0)
from storage.objects o
where o.bucket_id = 'daily-report-attachments' and o.name = dra.storage_path;

update public.report_attachments ra
set size_bytes = coalesce((o.metadata->>'size')::bigint, 0)
from storage.objects o
where o.bucket_id = 'report-attachments' and o.name = ra.storage_path;

update public.library_files lf
set size_bytes = coalesce((o.metadata->>'size')::bigint, 0)
from storage.objects o
where o.bucket_id = 'library-files' and o.name = lf.storage_path;

-- チームの合計使用量(バイト)。security definerにせず呼び出し元のRLSに従わせる。
-- 設定タブの使用量表示は管理者専用画面から呼ぶ想定で、管理者は全添付テーブルをselectできるため
-- (report_attachmentsのみ指導者・管理者限定)、管理者が呼ぶ限り正確な合計になる。
create or replace function public.team_storage_usage_bytes()
returns bigint
language sql
stable
set search_path = public
as $$
  select coalesce(sum(bytes), 0)::bigint from (
    select na.size_bytes as bytes
    from public.notice_attachments na
    join public.notices n on n.id = na.notice_id
    where n.team_id = public.current_team_id()
    union all
    select dra.size_bytes
    from public.daily_report_attachments dra
    join public.daily_reports dr on dr.id = dra.daily_report_id
    where dr.team_id = public.current_team_id()
    union all
    select ra.size_bytes
    from public.report_attachments ra
    join public.reports r on r.id = ra.report_id
    where r.team_id = public.current_team_id()
    union all
    select lf.size_bytes
    from public.library_files lf
    join public.library_items li on li.id = lf.library_item_id
    where li.team_id = public.current_team_id()
  ) t
$$;

grant execute on function public.team_storage_usage_bytes() to authenticated;
