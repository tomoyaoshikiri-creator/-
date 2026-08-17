-- チームの任意退会(完全削除)機能。即座には削除せず、7日間の猶予期間を設け、
-- その間は管理者が取り消せるようにする(実際の完全削除は日次バッチで行う)。
-- plan/stripe_*と同様に「退会手続き中」フラグも、通常のRLSクライアントから
-- 直接書き換えられると意図しない削除が起こり得るため、protect_team_billing_columns
-- トリガーの保護対象に追加する(書き込みはservice_role経由のAPI Routeのみ)。

alter table public.teams
  add column deletion_requested_at timestamptz,
  add column deletion_requested_by uuid references public.profiles(id);

create or replace function public.protect_team_billing_columns()
returns trigger
language plpgsql
as $$
begin
  if current_setting('role', true) = 'authenticated' then
    new.plan := old.plan;
    new.storage_limit_bytes := old.storage_limit_bytes;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.subscription_status := old.subscription_status;
    new.deletion_requested_at := old.deletion_requested_at;
    new.deletion_requested_by := old.deletion_requested_by;
  end if;
  return new;
end;
$$;
