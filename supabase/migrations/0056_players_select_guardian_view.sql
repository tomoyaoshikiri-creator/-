-- 選手一覧を一般・役員(保護者)にも「チーム全選手が見えるが、自分の子ども以外は
-- グレーアウトして選択できない」UIに変更するため、players のSELECTを
-- 「自分の子どもの行だけ」から「チーム全体」に広げる。
-- (登録・編集・削除は従来通り指導者・管理者のみに制限されたまま)
drop policy if exists players_select_own_child on public.players;

create policy players_select_guardian_view on public.players for select
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('一般', '役員')
  );
