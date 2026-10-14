begin;

-- get_default_team_logo_path()は、マルチチーム対応以前(1チーム専用運用だった頃)に
-- サービス全体のfavicon/PWAアイコンとして「DB内で最初に作成されたチームのロゴ」を
-- 流用するために使われていたRPC。現在はsrc/lib/brandIcon.tsが常に固定のCIRCLE LINES
-- ブランドアイコンを返す方式に置き換わっており、アプリ側からは一切呼び出されていない
-- (SECURITY DEFINER関数の全件監査で発見)。
-- チーム・権限の確認なしに任意のチームのロゴパスを返せてしまう不要な関数のため削除する。

drop function if exists public.get_default_team_logo_path();

commit;
