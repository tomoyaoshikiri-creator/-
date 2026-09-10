begin;

-- Push通知の濫用防止(A-8)。/api/push/notifyは従来クライアントから任意の
-- title/body/target*を受け取っており、認証済みメンバーなら誰でも任意文面で
-- チーム内に大量通知を送れる状態だった。アプリ側は{eventType, refId}だけを送り、
-- 文面・宛先はサーバー側(Route Handler)で対象データを引いて組み立てる方式に変更する。
-- このmigrationはその2つの土台(お知らせのaudience判定・頻度制限)をSQL側に用意する。

-- 1) お知らせの公開範囲(notices.audience)を尊重した通知先の算出。
-- notices_select(0027)のRLSポリシーと全く同じ条件をミラーする(判定がズレると
-- 「画面には出ないのに通知だけ届く」という新たな抜け道になるため、ロジックは1箇所
-- (このfunction)に集約し、ポリシー変更時はここも合わせて変更すること)。
create or replace function public.notice_audience_recipient_ids(p_notice_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tm.user_id
  from public.notices n
  join public.team_memberships tm on tm.team_id = n.team_id
  where n.id = p_notice_id
    and (
      tm.role in ('指導者', '管理者')
      or n.audience = '全員'
      or (n.audience = '役員以上' and tm.role = '役員')
      or (
        n.audience = '学年指定'
        and exists (
          select 1
          from public.player_guardians pg
          join public.players p on p.id = pg.player_id
          where pg.profile_id = tm.user_id
            and p.status = '在籍'
            and p.grade is not null
            and n.target_grade_min is not null
            and p.grade::int >= n.target_grade_min::int
        )
      )
    );
$$;

grant execute on function public.notice_audience_recipient_ids(uuid) to service_role;

-- 2) 頻度制限。同一ユーザーからの短時間の連投を弾く。Route Handlerからのアトミックな
-- チェック&インクリメントのため、行ロック(for update)を伴うplpgsql関数として実装する
-- (JS側でselect→updateを別々に行うと並行リクエストでレース条件が生まれるため)。
create table public.push_notify_rate_limits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  count int not null default 0
);

alter table public.push_notify_rate_limits enable row level security;
-- service_role専用(Route Handlerからのみ読み書きする)。ポリシーは作らない。

create or replace function public.check_and_increment_push_notify_rate_limit(
  p_user_id uuid, p_window_seconds int, p_max_count int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.push_notify_rate_limits;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select * into v_row from public.push_notify_rate_limits where user_id = p_user_id for update;

  if not found then
    insert into public.push_notify_rate_limits (user_id, window_started_at, count)
      values (p_user_id, now(), 1);
    return true;
  end if;

  if now() - v_row.window_started_at > make_interval(secs => p_window_seconds) then
    update public.push_notify_rate_limits
      set window_started_at = now(), count = 1
      where user_id = p_user_id;
    return true;
  end if;

  if v_row.count >= p_max_count then
    return false;
  end if;

  update public.push_notify_rate_limits set count = count + 1 where user_id = p_user_id;
  return true;
end;
$$;

grant execute on function public.check_and_increment_push_notify_rate_limit(uuid, int, int) to service_role;

commit;
