begin;

-- 会計機能 フェーズ5-1(集金管理・項目設定)。月謝などの集金項目を、チームごとに
-- 自由に追加できる汎用の仕組みで作る(ユーザー引き継ぎメモ 3-6)。請求の自動生成・
-- 入金チェック・会計への自動計上はフェーズ5-2、未納一覧・通知はフェーズ5-3で別途実装する。

create table public.accounting_dues_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  -- flat=一律、grade_band=学年帯ごと、per_player=選手ごとに個別指定(accounting_dues_player_settings.monthly_amountが基準額そのものになる)。
  pricing_method text not null check (pricing_method in ('flat', 'grade_band', 'per_player')),
  flat_monthly_amount numeric,
  -- 集金の周期(月数)。毎月=1、2か月=2、3か月=3、半年=6、年1回=12。常に年度始まり(4月)を
  -- 基準に連続したブロックとして期間を区切るため、別途「開始月」は持たない。
  cycle_months int not null check (cycle_months in (1, 2, 3, 6, 12)),
  payment_methods text[] not null default '{}',
  billing_unit text not null check (billing_unit in ('player', 'household')),
  income_category_id uuid not null references public.accounting_categories(id) on delete restrict,
  -- 未納通知を集金期間の開始から何日後に自動送信するか(null=自動送信しない)。フェーズ5-3で使用。
  reminder_days_after int,
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, name)
);
create index accounting_dues_items_team_idx on public.accounting_dues_items(team_id, position);

-- 学年帯ごとの月額(pricing_method='grade_band'の場合に使う)。grade_min/maxは
-- players.gradeと同じ絶対スケール(0=未就学、1-6=小学生、7-9=中学生...)。
create table public.accounting_dues_grade_bands (
  id uuid primary key default gen_random_uuid(),
  dues_item_id uuid not null references public.accounting_dues_items(id) on delete cascade,
  grade_min int not null,
  grade_max int not null,
  monthly_amount numeric not null,
  created_at timestamptz not null default now(),
  check (grade_min <= grade_max)
);
create index accounting_dues_grade_bands_item_idx on public.accounting_dues_grade_bands(dues_item_id);

-- 選手ごとの個別設定。pricing_method='per_player'の場合はmonthly_amountが基準額そのもの、
-- flat/grade_bandの場合はその選手だけの上書き額として扱う(nullなら上書きなし)。
-- exempt=trueは金額によらず免除。start_date/stop_dateは請求の開始・停止月
-- (ユーザー引き継ぎメモ 3-6 項番7、途中入部・退部は満額請求の方針)。
create table public.accounting_dues_player_settings (
  id uuid primary key default gen_random_uuid(),
  dues_item_id uuid not null references public.accounting_dues_items(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  monthly_amount numeric,
  exempt boolean not null default false,
  start_date date,
  stop_date date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dues_item_id, player_id)
);
create index accounting_dues_player_settings_item_idx on public.accounting_dues_player_settings(dues_item_id);
create index accounting_dues_player_settings_player_idx on public.accounting_dues_player_settings(player_id);

alter table public.accounting_dues_items enable row level security;
alter table public.accounting_dues_grade_bands enable row level security;
alter table public.accounting_dues_player_settings enable row level security;

-- 集金設定は家庭ごとの免除・金額上書きなど個人情報を含むため、accounting_transactionsと
-- 同様に一般(保護者)には見せず、運営以上のみ閲覧・編集可能にする。
create policy accounting_dues_items_select on public.accounting_dues_items for select
  using (team_id = public.current_team_id() and public.current_role() in ('運営', '指導者', '管理者'));
create policy accounting_dues_items_insert on public.accounting_dues_items for insert
  with check (team_id = public.current_team_id() and public.current_role() in ('運営', '指導者', '管理者'));
create policy accounting_dues_items_update on public.accounting_dues_items for update
  using (team_id = public.current_team_id() and public.current_role() in ('運営', '指導者', '管理者'))
  with check (team_id = public.current_team_id());
create policy accounting_dues_items_delete on public.accounting_dues_items for delete
  using (team_id = public.current_team_id() and public.current_role() in ('運営', '指導者', '管理者'));

create policy accounting_dues_grade_bands_select on public.accounting_dues_grade_bands for select
  using (exists (
    select 1 from public.accounting_dues_items di
    where di.id = dues_item_id and di.team_id = public.current_team_id()
      and public.current_role() in ('運営', '指導者', '管理者')
  ));
create policy accounting_dues_grade_bands_insert on public.accounting_dues_grade_bands for insert
  with check (exists (
    select 1 from public.accounting_dues_items di
    where di.id = dues_item_id and di.team_id = public.current_team_id()
      and public.current_role() in ('運営', '指導者', '管理者')
  ));
create policy accounting_dues_grade_bands_update on public.accounting_dues_grade_bands for update
  using (exists (
    select 1 from public.accounting_dues_items di
    where di.id = dues_item_id and di.team_id = public.current_team_id()
      and public.current_role() in ('運営', '指導者', '管理者')
  ))
  with check (exists (
    select 1 from public.accounting_dues_items di
    where di.id = dues_item_id and di.team_id = public.current_team_id()
  ));
create policy accounting_dues_grade_bands_delete on public.accounting_dues_grade_bands for delete
  using (exists (
    select 1 from public.accounting_dues_items di
    where di.id = dues_item_id and di.team_id = public.current_team_id()
      and public.current_role() in ('運営', '指導者', '管理者')
  ));

create policy accounting_dues_player_settings_select on public.accounting_dues_player_settings for select
  using (exists (
    select 1 from public.accounting_dues_items di
    where di.id = dues_item_id and di.team_id = public.current_team_id()
      and public.current_role() in ('運営', '指導者', '管理者')
  ));
create policy accounting_dues_player_settings_insert on public.accounting_dues_player_settings for insert
  with check (exists (
    select 1 from public.accounting_dues_items di
    where di.id = dues_item_id and di.team_id = public.current_team_id()
      and public.current_role() in ('運営', '指導者', '管理者')
  ));
create policy accounting_dues_player_settings_update on public.accounting_dues_player_settings for update
  using (exists (
    select 1 from public.accounting_dues_items di
    where di.id = dues_item_id and di.team_id = public.current_team_id()
      and public.current_role() in ('運営', '指導者', '管理者')
  ))
  with check (exists (
    select 1 from public.accounting_dues_items di
    where di.id = dues_item_id and di.team_id = public.current_team_id()
  ));
create policy accounting_dues_player_settings_delete on public.accounting_dues_player_settings for delete
  using (exists (
    select 1 from public.accounting_dues_items di
    where di.id = dues_item_id and di.team_id = public.current_team_id()
      and public.current_role() in ('運営', '指導者', '管理者')
  ));

create trigger enforce_accounting_plan_dues_items
before insert or update on public.accounting_dues_items
for each row execute function public.enforce_accounting_plan();

commit;
