begin;

-- 緊急修正。record_audit_event()の権限漏れ(0142)を調査する過程で、同じ原因
-- (このSupabaseプロジェクトのalter default privilegesが public スキーマの新規
-- 関数へ自動的にanon/authenticated/service_roleへexecute権限を付与する設定に
-- なっており、`revoke execute ... from public` だけでは各ロールへの直接付与分を
-- 取り消せない)による、より以前からの・より重大な権限漏れが他に4件見つかった。
-- いずれも元のmigration側では明示的に「service_roleのみ」を意図してrevoke from
-- public + grant to service_roleのみを行っていたが、実際にはauthenticated/anonからも
-- 直接呼び出せる状態だった:
--   - reserve_ai_analysis_usage / resolve_ai_analysis_usage(0102、AI分析の月間利用上限):
--     authenticatedから直接呼べると、resolve側をp_succeeded=falseで連打して消費枠を
--     戻し続けることで月間上限を実質無制限に回避できてしまう。また他チームの
--     p_team_idを指定して他チームの予約状態を操作できてしまう。
--   - notice_audience_recipient_ids(0139、お知らせのaudience絞り込み): 任意の
--     p_notice_idを指定でき、対象がSECURITY DEFINERでRLSを経由せず全お知らせの
--     audience対象者id一覧を取得できてしまう(他チームの情報開示)。
--   - check_and_increment_push_notify_rate_limit(0139、Push通知のレート制限):
--     任意のp_user_idを指定でき、他人のレート制限カウンタを外部から操作
--     (連打して恒久的に上限到達させ、その人へのPush通知を事実上止める)できてしまう。
-- ai_analysis_usage_count(0102)はservice_roleへも意図的に付与していない
-- (get_ai_analysis_usage/reserve_ai_analysis_usageの内部呼び出しはオーナー権限で
-- 実行されるため不要)が、同様にauthenticated/anonから直接呼べる状態だったため
-- あわせて修正する。
--
-- 実際に悪用された形跡があるかは別途ログ確認が必要(このmigration自体はDB側の
-- 権限修正のみ)。
revoke execute on function public.ai_analysis_usage_count(uuid, text) from authenticated, anon;
revoke execute on function public.reserve_ai_analysis_usage(uuid, uuid, uuid, int) from authenticated, anon;
revoke execute on function public.resolve_ai_analysis_usage(uuid, uuid, boolean) from authenticated, anon;
revoke execute on function public.notice_audience_recipient_ids(uuid) from authenticated, anon;
revoke execute on function public.check_and_increment_push_notify_rate_limit(uuid, int, int) from authenticated, anon;

commit;
