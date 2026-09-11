begin;

-- 負荷対策(B-10)。RLSのteam_idフィルタ・アプリ側のmatch_id検索で実質フルスキャンに
-- なっていた3箇所にインデックスを追加する。アプリ側のロジック変更は無い。

-- daily_reports: reportsテーブル(reports_team_id_idx)と同じ役割だが、コーチ日報分離
-- (0067)で新設した際にteam_idのインデックスが漏れていた。SELECT/INSERT/UPDATE/DELETE
-- いずれのRLSポリシーもteam_id = current_team_id()で絞り込むため、全操作に影響する。
create index daily_reports_team_id_idx on public.daily_reports(team_id, date desc);

-- game_matches: schedule_idのインデックス(0013)はあるが、/game/results(試合結果一覧)や
-- データエクスポートはteam_id単位で全件取得するため、RLSのteam_id絞り込みがフルスキャンに
-- なっていた。
create index game_matches_team_id_idx on public.game_matches(team_id);

-- game_player_stat_lines: player_idのインデックス(0044)はあるが、試合ごとのボックス
-- スコア画面(/game/stats/[matchId])はmatch_id単位で取得するため、こちらも必要。
create index game_player_stat_lines_match_id_idx on public.game_player_stat_lines(match_id);

commit;
