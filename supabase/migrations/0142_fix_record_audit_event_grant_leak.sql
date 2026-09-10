begin;

-- 緊急修正(B-3/0141直後)。record_audit_event()は「authenticated/anonから直接呼べない
-- ことで監査ログの改ざん・捏造を防ぐ」ことを目的にした関数だが、0141では
-- `revoke execute ... from public` しか行っておらず、実際には効いていなかった。
-- このSupabaseプロジェクトはpublicスキーマの新規オブジェクトに対して
-- alter default privileges で anon/authenticated/service_role へ自動的に
-- execute権限を付与する設定になっており、`from public`のrevokeだけでは
-- この個別付与分を取り消せない(PUBLICへのrevokeとロールへの直接grantは別物)。
-- 本番で`has_function_privilege('authenticated', 'public.record_audit_event(...)', 'execute')`
-- を確認したところtrueだったため、authenticated/anonから直接record_audit_event()を
-- 呼び出し、任意のteam_id・action・detailで偽の監査ログ行を挿入できる状態だった
-- (発見直後に本番へ本修正を適用済み。audit_logsは0行のままで実害なしを確認済み)。
revoke execute on function public.record_audit_event(uuid, text, text, uuid, jsonb) from authenticated, anon;

commit;
