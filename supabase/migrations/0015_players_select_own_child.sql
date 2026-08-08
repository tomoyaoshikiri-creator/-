-- playersテーブルは指導者・管理者しか閲覧できない制限になっていたため、
-- 保護者アカウント(一般・役員)が紐付けられた自分の子どもの情報を取得できず、
-- 出欠登録画面で選手名が表示されない不具合があった。
-- 自分がplayer_guardiansで紐付けられている選手だけは閲覧できるようにする。

create policy players_select_own_child on public.players for select
  using (
    team_id = public.current_team_id()
    and exists (
      select 1 from public.player_guardians pg
      where pg.player_id = players.id and pg.profile_id = auth.uid()
    )
  );
