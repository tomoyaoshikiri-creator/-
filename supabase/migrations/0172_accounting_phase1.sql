begin;

-- 会計機能 フェーズ1(予算案・入出金・会計報告のアプリ化、ユーザー引き継ぎメモ
-- 2026-10-11)。年度・項目マスタ・予算・会計担当/監査の指定を実装する。入出金登録・
-- 明細はフェーズ2、会計報告・PDF出力はフェーズ3、承認(押印)機能はフェーズ4で別PRにする。

-- 項目(勘定科目)。チームごとに自由に追加・編集・並べ替えできる(他チームへの販売を
-- 前提とするため固定にしない、ユーザー指示)。前年度繰越金のような自動計上項目は
-- auto_managed=trueとし、手入力の項目一覧には出さない(アプリ側で判断)。
create table public.accounting_categories (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  name text not null,
  position int not null default 0,
  auto_managed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (team_id, kind, name)
);
create index accounting_categories_team_kind_idx on public.accounting_categories(team_id, kind, position);

-- 年度ごとの締め状態。年度を締めると、その年度の収入決算額合計-支出決算額合計を
-- carried_over_amountに記録する(次年度の前年度繰越金の予算額・決算額への反映は
-- フェーズ3で実装)。進級処理(advance_academic_year)とは別の独立した操作とする
-- (会計の決算確定と選手の進級は必ずしも同じタイミングで行われないため)。
create table public.accounting_fiscal_years (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  fiscal_year int not null,
  closed boolean not null default false,
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  carried_over_amount numeric,
  created_at timestamptz not null default now(),
  unique (team_id, fiscal_year)
);

-- 項目ごとの予算額・備考(年度ごと)。
create table public.accounting_budgets (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  fiscal_year int not null,
  category_id uuid not null references public.accounting_categories(id) on delete cascade,
  budgeted_amount numeric not null default 0,
  note text,
  updated_at timestamptz not null default now(),
  unique (team_id, fiscal_year, category_id)
);

-- 会計担当(最大2名、アプリ側で案内)・会計監査(1名)の指定。利益相反を避けるため、
-- 同一人物が同チーム内で担当・監査を兼任することは禁止する(unique(team_id, user_id))。
create table public.accounting_officers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  officer_role text not null check (officer_role in ('担当', '監査')),
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

alter table public.accounting_categories enable row level security;
alter table public.accounting_fiscal_years enable row level security;
alter table public.accounting_budgets enable row level security;
alter table public.accounting_officers enable row level security;

-- 閲覧は全ロール(会計報告をフェーズ3で一般にも見せるため、項目名・予算額自体は
-- 機密情報ではない)。編集(追加・更新・削除)は運営以上。
create policy accounting_categories_select on public.accounting_categories for select
  using (team_id = public.current_team_id());
create policy accounting_categories_insert on public.accounting_categories for insert
  with check (team_id = public.current_team_id() and public.current_role() in ('運営', '指導者', '管理者'));
create policy accounting_categories_update on public.accounting_categories for update
  using (team_id = public.current_team_id() and public.current_role() in ('運営', '指導者', '管理者'))
  with check (team_id = public.current_team_id());
create policy accounting_categories_delete on public.accounting_categories for delete
  using (team_id = public.current_team_id() and public.current_role() in ('運営', '指導者', '管理者'));

create policy accounting_fiscal_years_select on public.accounting_fiscal_years for select
  using (team_id = public.current_team_id());
create policy accounting_fiscal_years_insert on public.accounting_fiscal_years for insert
  with check (team_id = public.current_team_id() and public.current_role() in ('運営', '指導者', '管理者'));
create policy accounting_fiscal_years_update on public.accounting_fiscal_years for update
  using (team_id = public.current_team_id() and public.current_role() in ('運営', '指導者', '管理者'))
  with check (team_id = public.current_team_id());

create policy accounting_budgets_select on public.accounting_budgets for select
  using (team_id = public.current_team_id());
create policy accounting_budgets_insert on public.accounting_budgets for insert
  with check (team_id = public.current_team_id() and public.current_role() in ('運営', '指導者', '管理者'));
create policy accounting_budgets_update on public.accounting_budgets for update
  using (team_id = public.current_team_id() and public.current_role() in ('運営', '指導者', '管理者'))
  with check (team_id = public.current_team_id());
create policy accounting_budgets_delete on public.accounting_budgets for delete
  using (team_id = public.current_team_id() and public.current_role() in ('運営', '指導者', '管理者'));

create policy accounting_officers_select on public.accounting_officers for select
  using (team_id = public.current_team_id());
create policy accounting_officers_insert on public.accounting_officers for insert
  with check (team_id = public.current_team_id() and public.current_role() in ('運営', '指導者', '管理者'));
create policy accounting_officers_update on public.accounting_officers for update
  using (team_id = public.current_team_id() and public.current_role() in ('運営', '指導者', '管理者'))
  with check (team_id = public.current_team_id());
create policy accounting_officers_delete on public.accounting_officers for delete
  using (team_id = public.current_team_id() and public.current_role() in ('運営', '指導者', '管理者'));

-- プラン検証トリガー(Pro以上限定、enforce_shaving_drill_planと同じ多層防御)。
create or replace function public.enforce_accounting_plan()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  team_plan text;
begin
  select plan into team_plan from public.teams where id = new.team_id;
  if team_plan not in ('フル', 'フルプラス', 'Max', 'max_partner', 'signature_edition') then
    raise exception '会計機能はProプラン以上限定です';
  end if;
  return new;
end;
$$;

create trigger enforce_accounting_plan_categories
before insert or update on public.accounting_categories
for each row execute function public.enforce_accounting_plan();

create trigger enforce_accounting_plan_fiscal_years
before insert or update on public.accounting_fiscal_years
for each row execute function public.enforce_accounting_plan();

create trigger enforce_accounting_plan_budgets
before insert or update on public.accounting_budgets
for each row execute function public.enforce_accounting_plan();

create trigger enforce_accounting_plan_officers
before insert or update on public.accounting_officers
for each row execute function public.enforce_accounting_plan();

commit;
