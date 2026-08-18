-- セキュリティ監査で見つかった2件のRLS不備を修正する。
--
-- ① attendances_update/deleteの管理者分岐にteam_idスコープがなく、
--    どのチームの管理者であっても他チームの出欠行(同行者・車両情報などを含む)を
--    改ざん・削除できてしまっていた(attendances_insertには元々このチェックがあった)。
--    scheduleのteam_idと一致することを明示的に要求するよう修正する。
--
-- ② report_comments_update/daily_report_comments_updateがprofile_id=auth.uid()の
--    みをチェックしており、コメント投稿者本人が自分のコメントのteam_idを
--    他チームのIDに書き換えられてしまっていた(他チームの非公開データが見える
--    わけではないが、他チームのコメント欄への不正なデータ混入につながる)。
--    with checkにteam_idの一致を追加する。

drop policy if exists attendances_update on public.attendances;
create policy attendances_update on public.attendances for update
using (
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
)
with check (
  exists (select 1 from public.schedules s where s.id = schedule_id and s.team_id = public.current_team_id())
);

drop policy if exists attendances_delete on public.attendances;
create policy attendances_delete on public.attendances for delete
using (
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

drop policy if exists report_comments_update on public.report_comments;
create policy report_comments_update on public.report_comments for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and team_id = public.current_team_id());

drop policy if exists daily_report_comments_update on public.daily_report_comments;
create policy daily_report_comments_update on public.daily_report_comments for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and team_id = public.current_team_id());
