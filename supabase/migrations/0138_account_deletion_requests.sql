begin;

-- サービスからの退会(アカウント完全削除、A-7)。ユーザーが「最後の管理者」である
-- チームがある場合、そのチームの7日猶予の削除申請(既存のteams.deletion_requested_at、
-- 0096・A-6)をトリガーしたうえで、猶予期間が終わりチームが実際に削除された時点で
-- auth.users自体を削除する。この待ち状態を記録するためのテーブル。
-- (「最後の管理者」ではない所属チームは、退会リクエスト時点で即座にteam_membershipsから
-- 脱退させるため、待ち状態を経ない。管理しているチームが1つもなければ、このテーブルには
-- 一切行を作らずその場でauth.admin.deleteUser()を呼ぶ。)
create table public.account_deletion_requests (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now()
);

-- service_role専用(API Route Handler・cronからのみ読み書きする)。ポリシーは作らない。
alter table public.account_deletion_requests enable row level security;

commit;
