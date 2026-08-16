-- 試合の予定に「ホーム/アウェイ」を持たせる。アウェイは従来通り車出しのヒアリング、
-- ホームは車出しの代わりに会場設営可否(可能な場合は人数)のヒアリングにする。
-- 保護者の帯同ヒアリングはホーム・アウェイどちらでも変わらず必要なため、既存のまま。
alter table public.schedules add column venue_type text check (venue_type in ('ホーム', 'アウェイ'));

-- 既存の試合の予定は、これまで通り車出しのヒアリング(アウェイ)を続ける。
update public.schedules set venue_type = 'アウェイ' where type = 'game';

alter table public.attendances add column setup_available text check (setup_available in ('あり', 'なし'));
alter table public.attendances add column setup_count int;
