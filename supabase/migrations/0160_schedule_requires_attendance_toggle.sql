-- 「その他」種別の予定は、必ずしも出欠登録を求める予定ばかりではないため、予定ごとに
-- 出欠登録そのものを求めるかどうかを選べるようにする(既定はON、既存予定は全て出欠登録を
-- 求める状態のまま変わらない)。練習・試合・イベントはこれまで通り常に出欠登録を求める
-- (UI側でtype="other"のときのみこの列を編集可能にする)。
alter table public.schedules add column requires_attendance boolean not null default true;
