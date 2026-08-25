begin;

-- 本番DBドリフト修復。0022_game_match_result_and_photo.sql(コミット27330da、
-- 以降無変更)で作成されたgame_records_deleteが、本番Supabaseにのみ存在しない
-- ことがord15比較(0112本番適用前確認)で判明した。ローカル検証環境・0022ファイル
-- に存在する正式な定義と完全に一致させて再作成する。0022自体は変更しない。
-- current_team_id()/current_role()や他のpolicy・関数は一切変更しない。

create policy game_records_delete on public.game_records for delete
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

commit;
