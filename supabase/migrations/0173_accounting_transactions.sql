begin;

-- 会計機能 フェーズ2(入出金登録・明細)。フェーズ1(項目・予算・会計担当/監査の指定)の
-- 続き。領収書の写真添付は今回は実装しない(別途フォローアップで追加)。

create table public.accounting_transactions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  fiscal_year int not null,
  -- 項目の削除で入出金の記録が消えると実際のお金の記録として困るため、budgetsとは異なり
  -- on delete restrictにする(参照中の項目は削除できない。アプリ側でエラーを案内する)。
  category_id uuid not null references public.accounting_categories(id) on delete restrict,
  transaction_date date not null,
  payee text not null,
  amount numeric not null check (amount > 0),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index accounting_transactions_team_fiscal_year_idx
  on public.accounting_transactions(team_id, fiscal_year, transaction_date desc);
create index accounting_transactions_category_idx
  on public.accounting_transactions(category_id, transaction_date desc);

alter table public.accounting_transactions enable row level security;

-- 一般(保護者)には会計報告のみ閲覧可能とする方針(フェーズ3で実装)のため、入出金の
-- 明細自体(支払先・備考に個人名が入ることもある)は運営以上限定で閲覧・編集とも揃える。
create policy accounting_transactions_select on public.accounting_transactions for select
  using (team_id = public.current_team_id() and public.current_role() in ('運営', '指導者', '管理者'));
create policy accounting_transactions_insert on public.accounting_transactions for insert
  with check (team_id = public.current_team_id() and public.current_role() in ('運営', '指導者', '管理者'));
create policy accounting_transactions_update on public.accounting_transactions for update
  using (team_id = public.current_team_id() and public.current_role() in ('運営', '指導者', '管理者'))
  with check (team_id = public.current_team_id());
create policy accounting_transactions_delete on public.accounting_transactions for delete
  using (team_id = public.current_team_id() and public.current_role() in ('運営', '指導者', '管理者'));

create trigger enforce_accounting_plan_transactions
before insert or update on public.accounting_transactions
for each row execute function public.enforce_accounting_plan();

commit;
