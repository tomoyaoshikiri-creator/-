begin;

-- 投票機能。意思決定・意見集計(複数選択可)とMVP投票(選手名簿から選択肢を作る)の
-- 両方をカバーする汎用的な仕組みとして実装する。使い方の違いはカテゴリーを分けず、
-- 作成時のオプション(複数選択可・匿名)で表現する。全プラン共通機能。

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  multi_select boolean not null default false,
  anonymous boolean not null default false,
  -- 投票できるロール。作成者(運営以上)が作成時に選ぶ。対象外ロールにも一覧上は
  -- 見せ、投票ボタンだけを無効化する(アプリ側の責務)。
  allowed_roles text[] not null default array['一般', '運営', '指導者', '管理者'],
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index polls_team_status_idx on public.polls (team_id, status, created_at desc);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index poll_options_poll_idx on public.poll_options (poll_id, position);

create table public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, option_id, voter_id)
);

create index poll_votes_poll_idx on public.poll_votes (poll_id);
create index poll_votes_voter_idx on public.poll_votes (voter_id);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

-- polls: 閲覧はチーム全員(対象外ロールにも存在は見せる)。作成は運営以上(一般は不可、
-- ユーザー指示)。編集・締め切り・削除は作成者またはスタッフ(指導者・管理者)。
create policy polls_select on public.polls for select
  using (team_id = public.current_team_id());

create policy polls_insert on public.polls for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('運営', '指導者', '管理者')
    and created_by = auth.uid()
  );

create policy polls_update on public.polls for update
  using (
    team_id = public.current_team_id()
    and (created_by = auth.uid() or public.current_role() in ('指導者', '管理者'))
  )
  with check (
    team_id = public.current_team_id()
    and (created_by = auth.uid() or public.current_role() in ('指導者', '管理者'))
  );

create policy polls_delete on public.polls for delete
  using (
    team_id = public.current_team_id()
    and (created_by = auth.uid() or public.current_role() in ('指導者', '管理者'))
  );

-- poll_options: 投票本体の権限にそのまま従う(個別の権限は持たない)。
create policy poll_options_select on public.poll_options for select
  using (exists (select 1 from public.polls p where p.id = poll_id and p.team_id = public.current_team_id()));

create policy poll_options_insert on public.poll_options for insert
  with check (
    exists (
      select 1 from public.polls p
      where p.id = poll_id
        and p.team_id = public.current_team_id()
        and (p.created_by = auth.uid() or public.current_role() in ('指導者', '管理者'))
    )
  );

create policy poll_options_update on public.poll_options for update
  using (
    exists (
      select 1 from public.polls p
      where p.id = poll_id
        and p.team_id = public.current_team_id()
        and (p.created_by = auth.uid() or public.current_role() in ('指導者', '管理者'))
    )
  )
  with check (
    exists (
      select 1 from public.polls p
      where p.id = poll_id
        and p.team_id = public.current_team_id()
        and (p.created_by = auth.uid() or public.current_role() in ('指導者', '管理者'))
    )
  );

create policy poll_options_delete on public.poll_options for delete
  using (
    exists (
      select 1 from public.polls p
      where p.id = poll_id
        and p.team_id = public.current_team_id()
        and (p.created_by = auth.uid() or public.current_role() in ('指導者', '管理者'))
    )
  );

-- poll_votes: 直接のテーブル操作では自分の票しか見えない(「投票済みです」の表示用)。
-- 集計・他人の票の開示は匿名性/締め切り/Signature Edition管理者の特例を厳密に判定する
-- 必要があるため、下のcast_poll_vote/poll_results(ともにSECURITY DEFINER)経由に限定し、
-- INSERT/UPDATE/DELETEの直接操作は一切許可しない(ポリシーを作らない=RLS有効下では
-- 常に拒否される)。
create policy poll_votes_select on public.poll_votes for select
  using (voter_id = auth.uid());

-- 投票を投じる・変更する。単一選択/複数選択・対象ロール・締め切り済みかどうかを
-- サーバー側で検証してから、既存の自分の票を置き換える(delete→insert)。
create or replace function public.cast_poll_vote(p_poll_id uuid, p_option_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_poll record;
  v_option_count int;
begin
  select * into v_poll from public.polls where id = p_poll_id and team_id = public.current_team_id();
  if v_poll is null then
    raise exception '投票が見つかりません';
  end if;
  if v_poll.status <> 'open' then
    raise exception 'この投票は締め切られています';
  end if;
  if not (public.current_role() = any(v_poll.allowed_roles)) then
    raise exception 'あなたのロールはこの投票の対象ではありません';
  end if;
  if p_option_ids is null or array_length(p_option_ids, 1) is null then
    raise exception '選択肢を選んでください';
  end if;
  if not v_poll.multi_select and array_length(p_option_ids, 1) > 1 then
    raise exception 'この投票は1つだけ選べます';
  end if;
  select count(*) into v_option_count from public.poll_options where poll_id = p_poll_id and id = any(p_option_ids);
  if v_option_count <> array_length(p_option_ids, 1) then
    raise exception '選択肢が無効です';
  end if;

  delete from public.poll_votes where poll_id = p_poll_id and voter_id = auth.uid();
  insert into public.poll_votes (poll_id, option_id, voter_id)
  select p_poll_id, opt_id, auth.uid() from unnest(p_option_ids) as opt_id;
end;
$$;

-- 結果の集計・開示。通常は締め切り後のみ開示し(得票数は常に、投票者名はanonymous=false
-- の場合のみ)、Signature Editionの管理者だけは締切前・匿名投票でも常に投票者名まで
-- 見られる(本人には非公表の監査用機能、ユーザー指示)。
create or replace function public.poll_results(p_poll_id uuid)
returns table (option_id uuid, option_label text, vote_count bigint, voter_ids uuid[])
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_poll record;
  v_team_plan text;
  v_reveal_voters boolean;
  v_allow_early boolean;
begin
  select * into v_poll from public.polls where id = p_poll_id and team_id = public.current_team_id();
  if v_poll is null then
    raise exception '投票が見つかりません';
  end if;

  select plan into v_team_plan from public.teams where id = v_poll.team_id;
  v_allow_early := (public.current_role() = '管理者' and v_team_plan = 'signature_edition');

  if not v_allow_early and v_poll.status <> 'closed' then
    return;
  end if;

  v_reveal_voters := v_allow_early or not v_poll.anonymous;

  return query
    select
      o.id,
      o.label,
      count(v.id),
      case when v_reveal_voters then array_agg(v.voter_id) filter (where v.voter_id is not null) else null end
    from public.poll_options o
    left join public.poll_votes v on v.option_id = o.id
    where o.poll_id = p_poll_id
    group by o.id, o.label, o.position
    order by o.position;
end;
$$;

commit;
