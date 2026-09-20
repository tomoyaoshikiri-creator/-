# 負荷対策: 既知の課題(未対応)

B-10で対応したのはDB層のインデックス欠落(`daily_reports`/`game_matches`/`game_player_stat_lines`、`supabase/migrations/0146_missing_load_indexes.sql`)のみ。調査の過程で見つけた、より影響範囲の大きい課題は未対応のまま記録する。

## 一覧画面のページングなし(対応済み・7/7)

以下の7画面すべてページングに対応済み:

- `/notice`(お知らせ一覧)✓
- `/report`(チーム日報一覧)✓
- `/coach-note`(コーチ日報一覧)✓
- `/library`(ライブラリ一覧)✓
- `/schedule/history`(予定の履歴)✓
- `/game/results`(試合結果一覧)✓
- `/players`(選手一覧)✓

`/coach-note`は他画面より遅れて対応(`COACH_NOTE_PAGE_SIZE = 30`、他画面と同じcursorベースの`loadMore`)。
`reports`テーブルは月の絞り込みが`date`列、並び順が`created_at`列と異なる列のため、`loadMore`側で
`date`の範囲(月の境界)と`created_at`のカーソル(取得済み件数の最後尾より古い)の両方を条件に含める
必要がある点に注意(`notice`/`report`等の他画面は絞り込みと並び順が同じ`created_at`列のため、
この考慮は不要だった)。

## 実際の負荷試験(スクリプトは用意済み・実行は未実施)

大量選手登録チーム・大量同時アクセスを想定した負荷試験(k6を使った実測)用のスクリプトを`loadtest/`に追加した(C-7)。ただし実際にどの環境に対して実行するかは人間の承認が必要なため、このスクリプトを使った実測自体はまだ実施していない。詳細は`loadtest/README.md`を参照。
