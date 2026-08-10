-- 日報の日付を「8/10」のような年を持たない自由入力(date_label)から、実際のdate型に置き換える。
-- これにより一覧で「2026年8月10日(日)」のように年・曜日まで正しく表示できるようになる。

alter table public.reports add column date date;

-- 既存データはdate_labelの月日をcreated_atの年に当てはめて復元する。
-- 結果がcreated_atより60日以上未来になる場合(年をまたいで記録したケース)は前年とみなす。
update public.reports r
set date = sub.computed_date
from (
  select
    id,
    case
      when make_date(
        extract(year from created_at)::int,
        split_part(date_label, '/', 1)::int,
        split_part(date_label, '/', 2)::int
      ) > (created_at::date + 60)
      then make_date(
        extract(year from created_at)::int - 1,
        split_part(date_label, '/', 1)::int,
        split_part(date_label, '/', 2)::int
      )
      else make_date(
        extract(year from created_at)::int,
        split_part(date_label, '/', 1)::int,
        split_part(date_label, '/', 2)::int
      )
    end as computed_date
  from public.reports
  where date_label ~ '^[0-9]{1,2}/[0-9]{1,2}$'
) sub
where r.id = sub.id;

-- date_labelが無い/形式が想定外の行はcreated_atの日付をそのまま採用する。
update public.reports set date = created_at::date where date is null;

alter table public.reports alter column date set not null;
alter table public.reports drop column date_label;
