begin;

-- ストレージ使用量の集計・強制チェックを全アップロード先(6バケット)に拡張する(A-10)。
-- これまでの状態:
--   - team_storage_usage_bytes()の集計対象は notice_attachments/daily_report_attachments/
--     report_attachments/library_files の4テーブルのみで、team-logos・game-score-photosは
--     一切カウントされていなかった。
--   - アップロード時に超過を拒否する強制チェック(DBトリガー)はlibrary_files向けの
--     enforce_library_storage_limit_triggerのみで、notice_attachments/
--     daily_report_attachments/report_attachmentsには付いていなかった。

-- 1) team-logosにSELECTポリシーが元々存在しなかった(INSERT/UPDATE/DELETEのみ、0003)。
-- 集計クエリがteam-logos配下のオブジェクトを読めるようにする(既存のinsert/update/delete
-- ポリシーと同じ条件: 自チームの管理者のみ)。
create policy team_logos_storage_select on storage.objects for select
  using (
    bucket_id = 'team-logos'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and public.current_role() = '管理者'
  );

-- 2) team_storage_usage_bytes()の集計にteam-logos・game-score-photosを追加。
-- この2バケットは添付行(size_bytes列を持つテーブル)を持たず、ファイルを直接置くだけの
-- モデルのため、storage.objects.metadata->>'size'(Storageが保持する実サイズ)を直接読む。
-- game-score-photosは既存のgame_score_photos_storage_select(0022、指導者・管理者)で
-- 既に読み取り可能。
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
    union all
    select coalesce((o.metadata->>'size')::bigint, 0)
    from storage.objects o
    where o.bucket_id = 'team-logos'
      and (storage.foldername(o.name))[1] = public.current_team_id()::text
    union all
    select coalesce((o.metadata->>'size')::bigint, 0)
    from storage.objects o
    where o.bucket_id = 'game-score-photos'
      and (storage.foldername(o.name))[1] = public.current_team_id()::text
  ) t
$$;

-- 3) 強制チェックをlibrary_filesだけでなく、notice_attachments/daily_report_attachments/
-- report_attachmentsにも広げる。関数の中身はsize_bytes列だけを見ており対象テーブルに
-- 依存しないため、既存のenforce_library_storage_limit()を汎用名にリネームして使い回す。
alter function public.enforce_library_storage_limit() rename to enforce_attachment_storage_limit;

drop trigger enforce_library_storage_limit_trigger on public.library_files;

create trigger enforce_attachment_storage_limit_trigger
  before insert on public.library_files
  for each row execute function public.enforce_attachment_storage_limit();

create trigger enforce_attachment_storage_limit_trigger
  before insert on public.notice_attachments
  for each row execute function public.enforce_attachment_storage_limit();

create trigger enforce_attachment_storage_limit_trigger
  before insert on public.daily_report_attachments
  for each row execute function public.enforce_attachment_storage_limit();

create trigger enforce_attachment_storage_limit_trigger
  before insert on public.report_attachments
  for each row execute function public.enforce_attachment_storage_limit();

-- 4) team-logos・game-score-photosは添付行を持たない(Storageに直接1ファイルだけ置く)
-- モデルのため、上記のような行insertトリガーではフックできない。storage.objects自体への
-- INSERTを対象バケットだけに絞ってフックする(このアプリで初めてstorage.objectsに
-- トリガーを付ける変更。対象バケットはwhen句で厳密に2つに限定し、insert自体は
-- 既存のRLS(team_logos_storage_insert・game_score_photos_storage_insert、
-- 自チームの管理者/指導者のみ)を通過済みのものにのみ発火する)。
create or replace function public.enforce_team_storage_limit_on_object()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  limit_bytes bigint;
  current_usage bigint;
  new_size bigint;
begin
  select storage_limit_bytes into limit_bytes from public.teams where id = public.current_team_id();
  new_size := coalesce((new.metadata->>'size')::bigint, 0);
  current_usage := public.team_storage_usage_bytes();
  if limit_bytes is not null and current_usage + new_size > limit_bytes then
    raise exception 'ストレージ容量の上限を超えるためアップロードできません';
  end if;
  return new;
end;
$$;

create trigger enforce_team_storage_limit_on_object_trigger
  before insert on storage.objects
  for each row
  when (new.bucket_id in ('team-logos', 'game-score-photos'))
  execute function public.enforce_team_storage_limit_on_object();

commit;
