-- ユーザー削除時に「誰が作成したか」系の外部キー制約でブロックされてしまう問題を修正する。
-- 作成者・送信者列を参照している行そのものは残し、参照先ユーザーが削除された場合は
-- 列をNULLにする(履歴データ自体は失われない)。

alter table public.invites alter column created_by drop not null;

alter table public.invites drop constraint invites_created_by_fkey;
alter table public.invites
  add constraint invites_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.invites drop constraint invites_used_by_fkey;
alter table public.invites
  add constraint invites_used_by_fkey
    foreign key (used_by) references public.profiles(id) on delete set null;

alter table public.schedules drop constraint schedules_created_by_fkey;
alter table public.schedules
  add constraint schedules_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.notices drop constraint notices_sender_id_fkey;
alter table public.notices
  add constraint notices_sender_id_fkey
    foreign key (sender_id) references public.profiles(id) on delete set null;

alter table public.reports drop constraint reports_author_id_fkey;
alter table public.reports
  add constraint reports_author_id_fkey
    foreign key (author_id) references public.profiles(id) on delete set null;

alter table public.player_notes drop constraint player_notes_author_id_fkey;
alter table public.player_notes
  add constraint player_notes_author_id_fkey
    foreign key (author_id) references public.profiles(id) on delete set null;
