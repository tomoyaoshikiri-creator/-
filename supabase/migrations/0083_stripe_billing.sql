-- Stripeでの課金管理に必要な列をteamsに追加する。
-- planとstorage_limit_bytesは既存のまま(0075のトリガーでplan変更時に自動追従)、
-- Stripe側の状態(顧客ID・サブスクリプションID・状態)をここに保持し、
-- Webhookで受け取ったイベントに応じてplanを更新する形にする。
alter table public.teams add column stripe_customer_id text;
alter table public.teams add column stripe_subscription_id text;
-- Stripeのsubscription.statusをそのまま保持する
-- (active/trialing/past_due/canceled/unpaid/incomplete/incomplete_expired等)。
alter table public.teams add column subscription_status text;

create unique index teams_stripe_customer_id_idx on public.teams(stripe_customer_id) where stripe_customer_id is not null;

-- 管理者はteams_update_by_admin(0002)でteams行を更新できるが、課金関連の列は
-- Stripe Webhook(service_roleキー)経由でのみ変更させたい(ブラウザから直接
-- planを書き換えて無料でプランを上げられてしまうのを防ぐ)。
-- PostgRESTからの通常リクエストはrole=authenticatedで実行されるため、そのときだけ
-- これらの列を元の値に戻す(SQL Editor(postgres)やWebhook(service_role)は素通りする)。
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
  end if;
  return new;
end;
$$;

create trigger protect_team_billing_columns_trigger
before update on public.teams
for each row execute function public.protect_team_billing_columns();
