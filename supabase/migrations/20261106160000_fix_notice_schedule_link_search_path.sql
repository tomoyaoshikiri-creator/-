-- get_advisors(security)のfunction_search_path_mutable(WARN)で指摘された、
-- 20261106120000で追加したvalidate_notice_related_schedule_team()にsearch_pathを
-- 明示する。既存の同種修正(0154_fix_function_search_path.sql)と同じ対応方針
-- (public, pg_tempに固定)。関数の処理内容・トリガー定義・権限は変更しない。

alter function public.validate_notice_related_schedule_team() set search_path = public, pg_temp;
