begin;

-- ライブラリにフォルダ機能(無制限の入れ子)を追加する。既存の「カテゴリー」
-- (library_categories)はチーム横断のフラットなタグとして残し、フォルダは
-- それとは別の階層的な「置き場所」として新設する(ユーザー相談で合意済み)。
-- ライブラリの基本的な整理機能のため、Signature限定にはせず全プラン共通とする。

create table public.library_folders (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  parent_folder_id uuid references public.library_folders(id) on delete set null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index library_folders_team_parent_idx on public.library_folders (team_id, parent_folder_id);

alter table public.library_items
  add column folder_id uuid references public.library_folders(id) on delete set null;

create index library_items_folder_idx on public.library_items (folder_id);

alter table public.library_folders enable row level security;

-- 閲覧:チームメンバー全員。作成:ライブラリ利用可能な全ロール(カテゴリー作成と同じ)。
-- 改名・移動(親の変更)・削除:スタッフ(指導者・管理者)のみ。誰でも構造を変更できると、
-- 他メンバーが整理した場所が意図せず壊れるため、カテゴリーのリネーム・削除(0149/0150)
-- と同じ考え方でスタッフに限定する。
create policy library_folders_select on public.library_folders for select
  using (team_id = public.current_team_id());

create policy library_folders_insert on public.library_folders for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('一般', '運営', '指導者', '管理者')
  );

create policy library_folders_update on public.library_folders for update
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
  )
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
  );

create policy library_folders_delete on public.library_folders for delete
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
  );

-- 循環参照防止:フォルダを自分自身の子孫の配下には移動できないようにする
-- (無制限の入れ子を許すため、親を祖先までたどって自分自身が含まれていないか確認する)。
create or replace function public.prevent_library_folder_cycle()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  cursor_id uuid;
begin
  if new.parent_folder_id is null then
    return new;
  end if;
  if new.parent_folder_id = new.id then
    raise exception 'フォルダを自分自身の中に移動することはできません';
  end if;
  cursor_id := new.parent_folder_id;
  while cursor_id is not null loop
    if cursor_id = new.id then
      raise exception 'フォルダを自分の子フォルダの中に移動することはできません';
    end if;
    select parent_folder_id into cursor_id from public.library_folders where id = cursor_id;
  end loop;
  return new;
end;
$$;

create trigger prevent_library_folder_cycle_trigger
before insert or update on public.library_folders
for each row execute function public.prevent_library_folder_cycle();

-- フォルダ削除時、直下の中身(サブフォルダ・資料)を1つ上の階層へ退避する(非破壊)。
-- カテゴリー削除時に資料が「カテゴリーなし」へ退避する(0150)のと同じ思想。
-- before deleteで先に退避させておくため、parent_folder_id/folder_idのon delete set null
-- は「退避させ忘れた場合の保険」として働く。
create or replace function public.promote_library_folder_children_before_delete()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update public.library_folders set parent_folder_id = old.parent_folder_id where parent_folder_id = old.id;
  update public.library_items set folder_id = old.parent_folder_id where folder_id = old.id;
  return old;
end;
$$;

create trigger promote_library_folder_children_before_delete_trigger
before delete on public.library_folders
for each row execute function public.promote_library_folder_children_before_delete();

commit;
