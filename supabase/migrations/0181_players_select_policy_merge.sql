begin;

-- playersのSELECTポリシーが「一般・運営向け」(players_select_guardian_view)と
-- 「指導者・管理者向け」(players_select)の2つに分かれていたが、合わせると
-- 全ロール(一般・運営・指導者・管理者)と同じであるため意味がない分割だった
-- (Supabaseのパフォーマンス診断でmultiple_permissive_policiesとして指摘)。
-- 1つにまとめる。選手一覧は保護者・運営を含めチーム全員分が見える仕様
-- (自分の子ども以外はアプリ側でグレーアウト、詳細ページは別途player_guardiansで
-- ガードされている)は変更しない。

drop policy players_select on public.players;
drop policy players_select_guardian_view on public.players;
create policy players_select on public.players for select
  using (team_id = public.current_team_id());

commit;
