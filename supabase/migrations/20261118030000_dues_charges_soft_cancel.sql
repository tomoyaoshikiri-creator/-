-- 請求の「取消」をDELETEではなくソフトキャンセル(cancelled_at/cancelled_by)に変更する。
-- accounting_dues_chargesにはDELETEのRLSポリシーが無く、クライアントからのDELETEは
-- 常にRLSで無言のまま0件削除になっていた(エラーにならないため画面上は成功に見えるが、
-- 実際にはDBの行が残り続けていた)。取消操作は既存のUPDATEポリシーで届く形に変更し、
-- 併せて取消の取り消し(復元)もできるようにする。
alter table public.accounting_dues_charges
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references public.profiles(id);
