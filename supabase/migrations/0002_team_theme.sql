-- チームごとの配色カスタマイズ(管理者が「設定」から変更できる基調色・アクセントカラー)
-- 未設定(null)の場合はアプリのデフォルト配色を使う。

alter table public.teams
  add column theme_primary text,
  add column theme_accent text;

alter table public.teams
  add constraint teams_theme_primary_format check (theme_primary is null or theme_primary ~* '^#[0-9a-f]{6}$'),
  add constraint teams_theme_accent_format check (theme_accent is null or theme_accent ~* '^#[0-9a-f]{6}$');

-- teams テーブルは今まで参照のみだったが、管理者は自チームの配色を更新できるようにする。
create policy teams_update_by_admin on public.teams for update
  using (id = public.current_team_id() and public.current_role() = '管理者')
  with check (id = public.current_team_id());
