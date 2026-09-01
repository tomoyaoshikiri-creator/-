begin;

-- 管理画面のメンバー一覧に「最終操作日時」を管理者のみに表示する機能。
-- auth.users.last_sign_in_at(最終ログイン日時)ではなく、アプリ内の実際の操作に
-- 近い時刻を出したいという要望のため、team_memberships側に専用の列を持たせ、
-- 認証済み画面を開くたびにRPC経由で更新する方式にする。

-- 1) team_memberships.last_active_at新設。
--    チーム単位の所属情報(team_memberships)に持たせる(1ユーザーが複数チームに
--    所属できるため、profiles側に持たせるとチームをまたいだ最終操作時刻しか
--    表現できない)。
alter table public.team_memberships
  add column last_active_at timestamptz;

-- 2) touch_last_active(): 現在アクティブなチームでの最終操作時刻を更新するRPC。
--    (app)/layout.tsx(認証済み画面共通のレイアウト)から、画面遷移のたびに
--    呼び出される想定。毎回書き込みが走ると負荷になるため、前回の記録から
--    5分未満の場合は更新しない(where句で対象0件になりno-opにする、
--    アプリ側での間引き制御は不要にする)。
create or replace function public.touch_last_active()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.team_memberships
  set last_active_at = now()
  where team_id = public.current_team_id()
    and user_id = auth.uid()
    and (last_active_at is null or last_active_at < now() - interval '5 minutes')
$$;

revoke execute on function public.touch_last_active() from public;
grant execute on function public.touch_last_active() to authenticated;

-- 3) list_team_members()再定義。戻り値にlast_active_atを追加する。
--    emailと同じく、管理者以外が呼び出した場合はnullを返す(RPC自体は
--    isAdminでない一般ユーザーからも呼べるため、サーバー側でも防御する)。
--    列の追加のみで、既存の列・順序・created_at(joined_atのエイリアス)は変更しない。
--    戻り値の列(OUT引数)構成が変わるため、create or replaceの前にdropが必要
--    (0103のget_invite_info等と同じ理由)。
drop function if exists public.list_team_members();
create or replace function public.list_team_members()
returns table(id uuid, name text, role text, status text, email text, created_at timestamptz, last_active_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.name,
    tm.role,
    tm.status,
    case when public.current_role() = '管理者' then p.email else null end,
    tm.joined_at,
    case when public.current_role() = '管理者' then tm.last_active_at else null end
  from public.team_memberships tm
  join public.profiles p on p.id = tm.user_id
  where tm.team_id = public.current_team_id()
  order by tm.joined_at asc
$$;

revoke execute on function public.list_team_members() from public;
grant execute on function public.list_team_members() to authenticated;

commit;
