-- 選手一覧から保護者が自分の子ども個人のカルテ(試合スタッツ・スポーツテスト表)を
-- 見られるようにするため、game_player_stat_lines のSELECTを、紐付いた保護者本人にも開放する。
-- (登録・編集・削除は従来通り指導者・管理者のみに制限されたまま)
drop policy if exists game_player_stat_lines_select on public.game_player_stat_lines;

create policy game_player_stat_lines_select on public.game_player_stat_lines for select
  using (
    team_id = public.current_team_id()
    and (
      public.current_role() in ('指導者', '管理者')
      or exists (
        select 1 from public.player_guardians pg
        where pg.player_id = game_player_stat_lines.player_id and pg.profile_id = auth.uid()
      )
    )
  );
