-- 予定に「対象」(全員 / ○年生以上)を設定できるようにする。nullは「全員」を意味する。
alter table public.schedules add column target_grade_min text;

-- これまでattendances_insert/updateはuser_id = auth.uid()であることしか検証しておらず、
-- player_idが実際にauth.uid()と紐付いている(player_guardians)かどうかはUI側の出し分け任せだった。
-- ここで紐付けチェックを追加しつつ、管理者は選手との紐付けに関わらず全選手の出欠を
-- 代理登録・編集できるよう例外にする。
drop policy if exists attendances_insert on public.attendances;
create policy attendances_insert on public.attendances for insert
with check (
  exists (select 1 from public.schedules s where s.id = schedule_id and s.team_id = public.current_team_id())
  and (
    public.current_role() = '管理者'
    or (
      user_id = auth.uid()
      and (
        player_id is null
        or exists (
          select 1 from public.player_guardians pg
          where pg.player_id = attendances.player_id and pg.profile_id = auth.uid()
        )
      )
    )
  )
);

drop policy if exists attendances_update on public.attendances;
create policy attendances_update on public.attendances for update
using (
  public.current_role() = '管理者'
  or (
    user_id = auth.uid()
    and (
      player_id is null
      or exists (
        select 1 from public.player_guardians pg
        where pg.player_id = attendances.player_id and pg.profile_id = auth.uid()
      )
    )
  )
);
