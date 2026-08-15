-- 実施メニューを手動で並び替えられるようにする。
alter table public.practice_menus add column position integer not null default 0;

-- 既存行は現在の並び順(updated_at昇順)をそのままpositionとして引き継ぐ。
with ordered as (
  select id, row_number() over (partition by schedule_id order by updated_at asc) - 1 as rn
  from public.practice_menus
)
update public.practice_menus pm
set position = ordered.rn
from ordered
where pm.id = ordered.id;
