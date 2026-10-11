begin;

-- 会計機能 フェーズ4(承認・押印)。会計担当・会計監査が本人のアカウントで
-- 「確認・承認」した場合のみ、会計報告の印欄に印影を表示する(押印C案)。
-- 本人の操作が無いのに印影だけを表示できる仕組みにはしない(ユーザー指示)ため、
-- INSERT/DELETEは本人(auth.uid() = 対象accounting_officers.user_id)のみに限定する。

create table public.accounting_approvals (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  fiscal_year int not null,
  officer_id uuid not null references public.accounting_officers(id) on delete cascade,
  approved_at timestamptz not null default now(),
  unique (fiscal_year, officer_id)
);
create index accounting_approvals_team_fiscal_year_idx on public.accounting_approvals(team_id, fiscal_year);

alter table public.accounting_approvals enable row level security;

create policy accounting_approvals_select on public.accounting_approvals for select
  using (team_id = public.current_team_id() and public.current_role() in ('運営', '指導者', '管理者'));

-- 承認(INSERT)・取り消し(DELETE)は、対象のaccounting_officers行の本人のみ行える。
-- 管理者であっても他人の代わりに承認することはできない。
create policy accounting_approvals_insert on public.accounting_approvals for insert
  with check (
    team_id = public.current_team_id()
    and exists (
      select 1 from public.accounting_officers ao
      where ao.id = officer_id and ao.team_id = public.current_team_id() and ao.user_id = auth.uid()
    )
  );
create policy accounting_approvals_delete on public.accounting_approvals for delete
  using (
    team_id = public.current_team_id()
    and exists (
      select 1 from public.accounting_officers ao
      where ao.id = officer_id and ao.team_id = public.current_team_id() and ao.user_id = auth.uid()
    )
  );

create trigger enforce_accounting_plan_approvals
before insert on public.accounting_approvals
for each row execute function public.enforce_accounting_plan();

-- 承認済みの年度で入出金が追加・変更・削除された場合、その年度の承認(担当・監査とも)を
-- 自動で取り消し、もう一度承認してもらう(ユーザー指示)。
create or replace function public.revoke_accounting_approvals_on_transaction_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_team_id uuid;
  v_fiscal_year int;
begin
  if tg_op = 'DELETE' then
    v_team_id := old.team_id;
    v_fiscal_year := old.fiscal_year;
  else
    v_team_id := new.team_id;
    v_fiscal_year := new.fiscal_year;
  end if;
  delete from public.accounting_approvals where team_id = v_team_id and fiscal_year = v_fiscal_year;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger revoke_accounting_approvals_on_transaction_change
after insert or update or delete on public.accounting_transactions
for each row execute function public.revoke_accounting_approvals_on_transaction_change();

commit;
