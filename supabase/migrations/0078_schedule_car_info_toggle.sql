-- 練習・イベントの予定でも、任意で車出し(乗り合わせ)のヒアリングを集約できるようにする。
-- 試合は既存のvenue_type(ホーム/アウェイ)でヒアリング内容が決まるため、この列は無視する。
alter table public.schedules add column collect_car_info boolean not null default false;
