-- スポーツテストで、その四半期に未実施の選手を明示的に区別できるようにする。
-- (数値が全て空欄=未入力なのか、そもそも実施していないのかを見分けるため)
alter table public.sports_test_records add column not_conducted boolean not null default false;
