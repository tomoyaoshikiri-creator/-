-- Pro AI Plusプラン(内部値: フルプラス)の追加と、AI分析機能(実際にAnthropic APIを
-- 呼び出して分析コメントを生成する)のためのデータ格納テーブル。
-- 生成結果は選手用・チーム用それぞれ追記型ログとして保存し(既存のanalysis_notesと同じ設計)、
-- レート制限(1チーム1日20回)もこの2テーブルの当日件数を数えるだけで実現する
-- (別途カウンタテーブルを設けない)。

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.teams'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%(plan =%';
  if cname is not null then
    execute format('alter table public.teams drop constraint %I', cname);
  end if;
end $$;

alter table public.teams add constraint teams_plan_check
  check (plan in ('お試し', '中間', 'フル', 'フルプラス', 'Max'));

-- AI分析結果(追記型ログ。生成のたびに1行追加。最新はcreated_at desc limit 1で取得)
create table public.player_ai_analysis (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  fiscal_year int not null,
  body text not null,
  generated_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index player_ai_analysis_player_id_idx on public.player_ai_analysis(player_id, fiscal_year, created_at desc);
create index player_ai_analysis_team_id_created_idx on public.player_ai_analysis(team_id, created_at);

create table public.team_ai_analysis (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  fiscal_year int not null,
  body text not null,
  generated_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index team_ai_analysis_team_id_idx on public.team_ai_analysis(team_id, fiscal_year, created_at desc);

alter table public.player_ai_analysis enable row level security;
alter table public.team_ai_analysis enable row level security;

-- 「分析用抽出」機能と同じく、閲覧・登録とも管理者のみ(指導者は不可)。
-- 生成物の編集・削除の概念がないため、update/deleteポリシーは設けない。
create policy player_ai_analysis_select on public.player_ai_analysis for select
  using (team_id = public.current_team_id() and public.current_role() = '管理者');
create policy player_ai_analysis_insert on public.player_ai_analysis for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() = '管理者'
    and generated_by = auth.uid()
  );

create policy team_ai_analysis_select on public.team_ai_analysis for select
  using (team_id = public.current_team_id() and public.current_role() = '管理者');
create policy team_ai_analysis_insert on public.team_ai_analysis for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() = '管理者'
    and generated_by = auth.uid()
  );
