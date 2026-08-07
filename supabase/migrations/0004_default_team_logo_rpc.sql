-- ホーム画面アイコン(favicon/apple-touch-icon/PWAマニフェスト)用に、
-- ログイン前の匿名アクセスでも「一番最初に作られたチーム」のロゴパスだけを取得できるRPC。
-- 現状はこのアプリを1チーム(都賀ビクトリーズ)専用で運用する前提のため、
-- 複数チームが本格的に混在する段階になったらこの関数は見直すこと。

create or replace function public.get_default_team_logo_path()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select logo_path from public.teams order by created_at asc limit 1
$$;

grant execute on function public.get_default_team_logo_path() to anon, authenticated;
