-- Supabaseのセキュリティ診断(function_search_path_mutable, WARN)で指摘された、
-- search_pathが未固定の関数17個にsearch_pathを明示する。
-- search_path未固定のSECURITY DEFINER/INVOKER関数は、呼び出し元のsearch_pathを
-- 通じて意図しないスキーマの同名オブジェクトを参照させられる可能性がある
-- (search path hijacking)。public, pg_tempに固定することで、既存の(publicスキーマの
-- テーブルを非修飾名で参照する)関数本体を壊さずにこのリスクを閉じる。

-- 注: get_advisorsの診断はこの実行時点の本番DBに対する結果のため、マイグレーション
-- 履歴に存在しない関数(過去にマイグレーションを経由せず直接作成されたもの)も
-- 含まれていた。enforce_daily_report_attachments_storage_limit/
-- enforce_notice_attachments_storage_limit/enforce_report_attachments_storage_limit/
-- enforce_library_files_storage_limitの4つがこれに該当し、実体は0140で
-- enforce_attachment_storage_limit()へ統合済みの重複ドリフトだったため、
-- 0156でドリフトごと削除する方針にした(このファイルではsearch_path固定の対象から外す)。
alter function public.apply_approved_skill_test_promotion() set search_path = public, pg_temp;
alter function public.enforce_attachment_storage_limit() set search_path = public, pg_temp;
alter function public.enforce_new_player_status() set search_path = public, pg_temp;
alter function public.enforce_player_limit() set search_path = public, pg_temp;
alter function public.enforce_signature_edition_team() set search_path = public, pg_temp;
alter function public.enforce_skill_test_max_plan() set search_path = public, pg_temp;
alter function public.enforce_skill_test_progress_max_plan() set search_path = public, pg_temp;
alter function public.enforce_sports_test_max_plan() set search_path = public, pg_temp;
alter function public.protect_skill_test_promotion_request_columns() set search_path = public, pg_temp;
alter function public.protect_team_billing_columns() set search_path = public, pg_temp;
alter function public.set_skill_test_progress_label() set search_path = public, pg_temp;
alter function public.sync_team_storage_limit() set search_path = public, pg_temp;
alter function public.skill_test_level_label(
  kyu_count integer, dan_count integer, level_index integer, dan_kyu_count integer,
  kyu_label text, dan_label text, chapters jsonb
) set search_path = public, pg_temp;
