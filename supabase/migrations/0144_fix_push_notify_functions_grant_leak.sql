begin;

-- 0143の続き。notice_audience_recipient_ids/check_and_increment_push_notify_rate_limitは
-- 0143の`revoke ... from authenticated, anon`を適用した後も、本番で確認したところ
-- 直接呼び出せる状態のままだった。
-- 原因: この2関数はもともと(0139)`revoke ... from public`自体を一度も行っておらず、
-- PUBLICロールへの実行権限が生きたまま。authenticated/anonはPUBLICのメンバーとして
-- 権限を継承するため、authenticated/anon個別のrevokeだけでは不十分だった
-- (ai_analysis系3関数は0102で最初からrevoke from publicしていたため、0143だけで
-- 正しく塞がっていた)。PUBLICからも明示的にrevokeする。
revoke execute on function public.notice_audience_recipient_ids(uuid) from public;
revoke execute on function public.check_and_increment_push_notify_rate_limit(uuid, int, int) from public;

commit;
