-- チームごとにログイン画面(/login/[slug])のロゴ・表記を出し分けられるようにする。
-- slugはチーム作成時に自動採番される12文字のランダム英数字で、ログイン前の匿名アクセスからでも
-- 参照できる必要があるため、通常のRLS(current_team_id()ベース)は使えず専用のSECURITY DEFINER
-- 関数(get_team_login_branding)で必要最小限の公開情報(チーム名・ロゴ)だけを返す。
alter table public.teams add column slug text unique
  default encode(gen_random_bytes(6), 'hex');

-- 既存行(都賀ビクトリーズ)にもバックフィルする。ロゴ・チーム名は元々未カスタマイズのままなので、
-- このURLでアクセスしてもClubLinkの共通表示が出るだけで、見た目には影響しない。
update public.teams set slug = encode(gen_random_bytes(6), 'hex') where slug is null;

alter table public.teams alter column slug set not null;

create or replace function public.get_team_login_branding(p_slug text)
returns table (name text, logo_path text)
language sql
security definer
stable
set search_path = public
as $$
  select t.name, t.logo_path
  from public.teams t
  where t.slug = p_slug;
$$;

grant execute on function public.get_team_login_branding(text) to anon, authenticated;
