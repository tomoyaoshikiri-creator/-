-- 試合結果(自チーム・相手チームの得点)とスコア写真を試合(game_matches)に記録できるようにする。
-- 勝敗は得点から自動判定して画面表示するため、専用の列は持たない。
alter table public.game_matches add column team_score int;
alter table public.game_matches add column opponent_score int;
alter table public.game_matches add column score_photo_path text;

insert into storage.buckets (id, name, public)
values ('game-score-photos', 'game-score-photos', false)
on conflict (id) do nothing;

create policy game_score_photos_storage_select on storage.objects for select
  using (
    bucket_id = 'game-score-photos'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and public.current_role() in ('指導者', '管理者')
  );

create policy game_score_photos_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'game-score-photos'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and public.current_role() in ('指導者', '管理者')
  );

create policy game_score_photos_storage_delete on storage.objects for delete
  using (
    bucket_id = 'game-score-photos'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and public.current_role() in ('指導者', '管理者')
  );

-- game_recordsに削除ポリシーが無かったため追加する(スタメン・途中出場登録の削除に必要)。
create policy game_records_delete on public.game_records for delete
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
