-- スタンプの種類に🙏(pray)を追加する。
-- 制約名を決め打ちせず、reaction_type列にかかっているcheck制約を動的に探して置き換える。
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.player_note_reactions'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%reaction_type%';
  if con_name is not null then
    execute format('alter table public.player_note_reactions drop constraint %I', con_name);
  end if;
end $$;

alter table public.player_note_reactions
  add constraint player_note_reactions_reaction_type_check
  check (reaction_type in ('thumbs_up', 'ok_gesture', 'bow', 'pray'));
