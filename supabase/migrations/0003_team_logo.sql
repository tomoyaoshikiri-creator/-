-- チームごとのロゴ画像アップロード機能
-- ロゴは機密情報ではないため公開バケットにし、アプリ内では公開URLをそのまま <img> で表示する。

alter table public.teams
  add column logo_path text;

insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true)
on conflict (id) do nothing;

create policy team_logos_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'team-logos'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and public.current_role() = '管理者'
  );

create policy team_logos_storage_update on storage.objects for update
  using (
    bucket_id = 'team-logos'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and public.current_role() = '管理者'
  );

create policy team_logos_storage_delete on storage.objects for delete
  using (
    bucket_id = 'team-logos'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and public.current_role() = '管理者'
  );
