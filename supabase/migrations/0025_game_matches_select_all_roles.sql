-- 試合記録タブを一般・役員にも「結果閲覧専用」として開放するため、game_matchesの閲覧を
-- 指導者・管理者限定から全ロール(チーム内)に広げる。登録・編集・削除は引き続き指導者・管理者のみ。
drop policy game_matches_select on public.game_matches;
create policy game_matches_select on public.game_matches for select
  using (team_id = public.current_team_id());
