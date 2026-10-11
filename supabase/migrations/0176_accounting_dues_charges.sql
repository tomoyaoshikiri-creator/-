begin;

-- 会計機能 フェーズ5-2(集金管理・請求自動生成/入金チェック/会計への自動計上)。
-- フェーズ5-1(集金項目の設定)の続き。請求の生成はcron(service_role)または運営以上の
-- 手動トリガーで行い、どちらもAPIルート側でTypeScriptとして実装する(選手の学年・
-- 保護者紐付け・個別設定を横断する処理のため、DB関数ではなくアプリ側に置く)。

create table public.accounting_dues_billing_periods (
  id uuid primary key default gen_random_uuid(),
  dues_item_id uuid not null references public.accounting_dues_items(id) on delete cascade,
  fiscal_year int not null,
  period_start date not null,
  period_end date not null,
  generated_at timestamptz not null default now(),
  -- 入金済みの合計額を計上した会計入出金(accounting_transactions)。入金が0件に戻ったら
  -- nullに戻し、対応する入出金レコードも削除する(sync_dues_billing_period_transaction参照)。
  transaction_id uuid references public.accounting_transactions(id) on delete set null,
  unique (dues_item_id, period_start)
);
create index accounting_dues_billing_periods_item_idx on public.accounting_dues_billing_periods(dues_item_id, period_start);

create table public.accounting_dues_charges (
  id uuid primary key default gen_random_uuid(),
  billing_period_id uuid not null references public.accounting_dues_billing_periods(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  -- 請求の単位が「家庭ごと」のとき、同じ主たる保護者を持つ選手をまとめてチェックできる
  -- ようグループ化するためのキー(保護者のprofile_id)。「選手ごと」のときはplayer_idと同じ値にする。
  group_key uuid not null,
  amount numeric not null check (amount > 0),
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  paid_at timestamptz,
  paid_by uuid references public.profiles(id) on delete set null,
  -- 未納通知を送信済みかどうかの記録(フェーズ5-3で使用)。
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (billing_period_id, player_id)
);
create index accounting_dues_charges_period_idx on public.accounting_dues_charges(billing_period_id);
create index accounting_dues_charges_group_idx on public.accounting_dues_charges(billing_period_id, group_key);

alter table public.accounting_dues_billing_periods enable row level security;
alter table public.accounting_dues_charges enable row level security;

-- 生成(insert)・会計連携(update)はservice_roleまたはトリガーのみが行うため、
-- クライアント向けのポリシーはselectのみで十分(他のaccounting系と同様、運営以上限定)。
create policy accounting_dues_billing_periods_select on public.accounting_dues_billing_periods for select
  using (exists (
    select 1 from public.accounting_dues_items di
    where di.id = dues_item_id and di.team_id = public.current_team_id()
      and public.current_role() in ('運営', '指導者', '管理者')
  ));

create policy accounting_dues_charges_select on public.accounting_dues_charges for select
  using (exists (
    select 1 from public.accounting_dues_billing_periods bp
    join public.accounting_dues_items di on di.id = bp.dues_item_id
    where bp.id = billing_period_id and di.team_id = public.current_team_id()
      and public.current_role() in ('運営', '指導者', '管理者')
  ));
-- 入金チェック(入金済み/未納の切り替え)は運営以上が行う唯一のクライアント書き込み。
create policy accounting_dues_charges_update on public.accounting_dues_charges for update
  using (exists (
    select 1 from public.accounting_dues_billing_periods bp
    join public.accounting_dues_items di on di.id = bp.dues_item_id
    where bp.id = billing_period_id and di.team_id = public.current_team_id()
      and public.current_role() in ('運営', '指導者', '管理者')
  ))
  with check (exists (
    select 1 from public.accounting_dues_billing_periods bp
    join public.accounting_dues_items di on di.id = bp.dues_item_id
    where bp.id = billing_period_id and di.team_id = public.current_team_id()
  ));

-- 入金済み件数・合計額が変わるたびに、その集金期間の会計入出金(1件にまとめたもの)を
-- 自動で作成・更新・削除する(ユーザー引き継ぎメモ 3-6 項番4、項目ごとに1件にまとめる)。
create or replace function public.sync_dues_billing_period_transaction() returns trigger language plpgsql set search_path = public, pg_temp as $$ declare v_period record; v_item record; v_paid_count int; v_paid_total numeric; v_period_id uuid; v_label text; v_txn_id uuid; begin v_period_id := coalesce(new.billing_period_id, old.billing_period_id); select * into v_period from public.accounting_dues_billing_periods where id = v_period_id; select * into v_item from public.accounting_dues_items where id = v_period.dues_item_id; select count(*), coalesce(sum(amount), 0) into v_paid_count, v_paid_total from public.accounting_dues_charges where billing_period_id = v_period_id and status = 'paid'; if to_char(v_period.period_start, 'FMMM') = to_char(v_period.period_end, 'FMMM') then v_label := to_char(v_period.period_start, 'FMMM') || '月分 ' || v_item.name || ' ' || v_paid_count || '名'; else v_label := to_char(v_period.period_start, 'FMMM') || '〜' || to_char(v_period.period_end, 'FMMM') || '月分 ' || v_item.name || ' ' || v_paid_count || '名'; end if; if v_paid_count = 0 then if v_period.transaction_id is not null then delete from public.accounting_transactions where id = v_period.transaction_id; update public.accounting_dues_billing_periods set transaction_id = null where id = v_period_id; end if; elsif v_period.transaction_id is null then insert into public.accounting_transactions (team_id, fiscal_year, category_id, transaction_date, payee, amount) values (v_item.team_id, v_period.fiscal_year, v_item.income_category_id, v_period.period_start, v_label, v_paid_total) returning id into v_txn_id; update public.accounting_dues_billing_periods set transaction_id = v_txn_id where id = v_period_id; else update public.accounting_transactions set payee = v_label, amount = v_paid_total, updated_at = now() where id = v_period.transaction_id; end if; return coalesce(new, old); end; $$;

create trigger sync_dues_billing_period_transaction
after insert or update or delete on public.accounting_dues_charges
for each row execute function public.sync_dues_billing_period_transaction();

commit;
