begin;

-- お知らせへのリアクション追加を新着判定に反映できるようにするため、更新日時を追加する
-- (player_notes/reports等と同じ理由。0061・0062参照)。既存行はmigration適用時刻が
-- 入るため、適用直後は既存の全お知らせが一時的に「新着」扱いになりうるが、これは
-- 0061・0062で確立済みの許容範囲(過去の同種migrationと同じ挙動)。
alter table public.notices add column updated_at timestamptz not null default now();

commit;
