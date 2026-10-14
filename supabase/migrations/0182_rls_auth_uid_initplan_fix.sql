-- 全85件のRLSポリシーで、ポリシー内のauth.uid()呼び出しを(select auth.uid())に書き換え、
-- 行ごとではなくクエリ全体で1回だけ評価されるようにする(Supabaseパフォーマンス診断
-- auth_rls_initplanの指摘対応)。ロジック自体は一切変更していない(機械的な書き換えのみ)。

begin;

drop policy profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using ((id = (select auth.uid())))
  with check ((id = (select auth.uid())));

drop policy invites_insert on public.invites;
create policy invites_insert on public.invites for insert
  with check (((team_id = current_team_id()) AND (created_by = (select auth.uid())) AND (("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) OR (("current_role"() = '運営'::text) AND (role = '一般'::text)))));

drop policy attendances_delete on public.attendances;
create policy attendances_delete on public.attendances for delete
  using (((EXISTS ( SELECT 1
   FROM schedules s
  WHERE ((s.id = attendances.schedule_id) AND (s.team_id = current_team_id())))) AND (("current_role"() = '管理者'::text) OR ((user_id = (select auth.uid())) AND ((player_id IS NULL) OR (EXISTS ( SELECT 1
   FROM player_guardians pg
  WHERE ((pg.player_id = attendances.player_id) AND (pg.profile_id = (select auth.uid()))))))))));

drop policy attendances_insert on public.attendances;
create policy attendances_insert on public.attendances for insert
  with check (((EXISTS ( SELECT 1
   FROM schedules s
  WHERE ((s.id = attendances.schedule_id) AND (s.team_id = current_team_id())))) AND (("current_role"() = '管理者'::text) OR ((user_id = (select auth.uid())) AND ((player_id IS NULL) OR (EXISTS ( SELECT 1
   FROM player_guardians pg
  WHERE ((pg.player_id = attendances.player_id) AND (pg.profile_id = (select auth.uid()))))))))));

drop policy attendances_update on public.attendances;
create policy attendances_update on public.attendances for update
  using (((EXISTS ( SELECT 1
   FROM schedules s
  WHERE ((s.id = attendances.schedule_id) AND (s.team_id = current_team_id())))) AND (("current_role"() = '管理者'::text) OR ((user_id = (select auth.uid())) AND ((player_id IS NULL) OR (EXISTS ( SELECT 1
   FROM player_guardians pg
  WHERE ((pg.player_id = attendances.player_id) AND (pg.profile_id = (select auth.uid()))))))))))
  with check ((EXISTS ( SELECT 1
   FROM schedules s
  WHERE ((s.id = attendances.schedule_id) AND (s.team_id = current_team_id())))));

drop policy notices_insert on public.notices;
create policy notices_insert on public.notices for insert
  with check (((team_id = current_team_id()) AND ("current_role"() = ANY (ARRAY['一般'::text, '運営'::text, '指導者'::text, '管理者'::text])) AND (sender_id = (select auth.uid()))));

drop policy notices_select on public.notices;
create policy notices_select on public.notices for select
  using (((team_id = current_team_id()) AND (("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) OR (audience = '全員'::text) OR ((audience = '運営以上'::text) AND ("current_role"() = '運営'::text)) OR ((audience = '学年指定'::text) AND ((EXISTS ( SELECT 1
   FROM (player_guardians pg
     JOIN players p ON ((p.id = pg.player_id)))
  WHERE ((pg.profile_id = (select auth.uid())) AND (p.status = '在籍'::text) AND (p.grade IS NOT NULL) AND (notices.target_grade_min IS NOT NULL) AND ((p.grade)::integer >= (notices.target_grade_min)::integer)))) OR (NOT (EXISTS ( SELECT 1
   FROM (player_guardians pg
     JOIN players p ON ((p.id = pg.player_id)))
  WHERE ((pg.profile_id = (select auth.uid())) AND (p.status = '在籍'::text))))))))));

drop policy notice_attachments_select on public.notice_attachments;
create policy notice_attachments_select on public.notice_attachments for select
  using ((EXISTS ( SELECT 1
   FROM notices n
  WHERE ((n.id = notice_attachments.notice_id) AND (n.team_id = current_team_id()) AND (("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) OR (n.audience = '全員'::text) OR ((n.audience = '運営以上'::text) AND ("current_role"() = '運営'::text)) OR ((n.audience = '学年指定'::text) AND ((EXISTS ( SELECT 1
           FROM (player_guardians pg
             JOIN players p ON ((p.id = pg.player_id)))
          WHERE ((pg.profile_id = (select auth.uid())) AND (p.status = '在籍'::text) AND (p.grade IS NOT NULL) AND (n.target_grade_min IS NOT NULL) AND ((p.grade)::integer >= (n.target_grade_min)::integer)))) OR (NOT (EXISTS ( SELECT 1
           FROM (player_guardians pg
             JOIN players p ON ((p.id = pg.player_id)))
          WHERE ((pg.profile_id = (select auth.uid())) AND (p.status = '在籍'::text))))))))))));

drop policy reports_insert on public.reports;
create policy reports_insert on public.reports for insert
  with check (((team_id = current_team_id()) AND (author_id = (select auth.uid())) AND ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text]))));

drop policy player_notes_insert on public.player_notes;
create policy player_notes_insert on public.player_notes for insert
  with check (((team_id = current_team_id()) AND ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) AND (author_id = (select auth.uid()))));

drop policy player_guardians_select on public.player_guardians;
create policy player_guardians_select on public.player_guardians for select
  using (((team_id = current_team_id()) AND ((profile_id = (select auth.uid())) OR ("current_role"() = ANY (ARRAY['運営'::text, '指導者'::text, '管理者'::text])))));

drop policy sports_test_records_delete on public.sports_test_records;
create policy sports_test_records_delete on public.sports_test_records for delete
  using (((team_id = current_team_id()) AND (("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) OR (EXISTS ( SELECT 1
   FROM player_guardians pg
  WHERE ((pg.player_id = sports_test_records.player_id) AND (pg.profile_id = (select auth.uid()))))))));

drop policy sports_test_records_insert on public.sports_test_records;
create policy sports_test_records_insert on public.sports_test_records for insert
  with check (((team_id = current_team_id()) AND (("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) OR (EXISTS ( SELECT 1
   FROM player_guardians pg
  WHERE ((pg.player_id = sports_test_records.player_id) AND (pg.profile_id = (select auth.uid()))))))));

drop policy sports_test_records_select on public.sports_test_records;
create policy sports_test_records_select on public.sports_test_records for select
  using (((team_id = current_team_id()) AND (("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) OR (EXISTS ( SELECT 1
   FROM player_guardians pg
  WHERE ((pg.player_id = sports_test_records.player_id) AND (pg.profile_id = (select auth.uid()))))))));

drop policy sports_test_records_update on public.sports_test_records;
create policy sports_test_records_update on public.sports_test_records for update
  using (((team_id = current_team_id()) AND (("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) OR (EXISTS ( SELECT 1
   FROM player_guardians pg
  WHERE ((pg.player_id = sports_test_records.player_id) AND (pg.profile_id = (select auth.uid()))))))))
  with check ((team_id = current_team_id()));

drop policy player_growth_records_delete on public.player_growth_records;
create policy player_growth_records_delete on public.player_growth_records for delete
  using (((team_id = current_team_id()) AND (("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) OR (EXISTS ( SELECT 1
   FROM player_guardians pg
  WHERE ((pg.player_id = player_growth_records.player_id) AND (pg.profile_id = (select auth.uid()))))))));

drop policy player_growth_records_insert on public.player_growth_records;
create policy player_growth_records_insert on public.player_growth_records for insert
  with check (((team_id = current_team_id()) AND (recorded_by = (select auth.uid())) AND (("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) OR (EXISTS ( SELECT 1
   FROM player_guardians pg
  WHERE ((pg.player_id = player_growth_records.player_id) AND (pg.profile_id = (select auth.uid()))))))));

drop policy player_growth_records_select on public.player_growth_records;
create policy player_growth_records_select on public.player_growth_records for select
  using (((team_id = current_team_id()) AND (("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) OR (EXISTS ( SELECT 1
   FROM player_guardians pg
  WHERE ((pg.player_id = player_growth_records.player_id) AND (pg.profile_id = (select auth.uid()))))))));

drop policy player_growth_records_update on public.player_growth_records;
create policy player_growth_records_update on public.player_growth_records for update
  using (((team_id = current_team_id()) AND (("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) OR (EXISTS ( SELECT 1
   FROM player_guardians pg
  WHERE ((pg.player_id = player_growth_records.player_id) AND (pg.profile_id = (select auth.uid()))))))))
  with check ((team_id = current_team_id()));

drop policy player_note_reactions_delete on public.player_note_reactions;
create policy player_note_reactions_delete on public.player_note_reactions for delete
  using ((profile_id = (select auth.uid())));

drop policy player_note_reactions_insert on public.player_note_reactions;
create policy player_note_reactions_insert on public.player_note_reactions for insert
  with check (((team_id = current_team_id()) AND ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) AND (profile_id = (select auth.uid()))));

drop policy notice_reactions_delete on public.notice_reactions;
create policy notice_reactions_delete on public.notice_reactions for delete
  using ((profile_id = (select auth.uid())));

drop policy notice_reactions_insert on public.notice_reactions;
create policy notice_reactions_insert on public.notice_reactions for insert
  with check (((profile_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM notices n
  WHERE ((n.id = notice_reactions.notice_id) AND (n.team_id = current_team_id()) AND (n.team_id = n.team_id) AND (("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) OR (n.audience = '全員'::text) OR ((n.audience = '運営以上'::text) AND ("current_role"() = '運営'::text)) OR ((n.audience = '学年指定'::text) AND ((EXISTS ( SELECT 1
           FROM (player_guardians pg
             JOIN players p ON ((p.id = pg.player_id)))
          WHERE ((pg.profile_id = (select auth.uid())) AND (p.status = '在籍'::text) AND (p.grade IS NOT NULL) AND (n.target_grade_min IS NOT NULL) AND ((p.grade)::integer >= (n.target_grade_min)::integer)))) OR (NOT (EXISTS ( SELECT 1
           FROM (player_guardians pg
             JOIN players p ON ((p.id = pg.player_id)))
          WHERE ((pg.profile_id = (select auth.uid())) AND (p.status = '在籍'::text)))))))))))));

drop policy notice_reactions_select on public.notice_reactions;
create policy notice_reactions_select on public.notice_reactions for select
  using ((EXISTS ( SELECT 1
   FROM notices n
  WHERE ((n.id = notice_reactions.notice_id) AND (n.team_id = current_team_id()) AND (("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) OR (n.audience = '全員'::text) OR ((n.audience = '運営以上'::text) AND ("current_role"() = '運営'::text)) OR ((n.audience = '学年指定'::text) AND ((EXISTS ( SELECT 1
           FROM (player_guardians pg
             JOIN players p ON ((p.id = pg.player_id)))
          WHERE ((pg.profile_id = (select auth.uid())) AND (p.status = '在籍'::text) AND (p.grade IS NOT NULL) AND (n.target_grade_min IS NOT NULL) AND ((p.grade)::integer >= (n.target_grade_min)::integer)))) OR (NOT (EXISTS ( SELECT 1
           FROM (player_guardians pg
             JOIN players p ON ((p.id = pg.player_id)))
          WHERE ((pg.profile_id = (select auth.uid())) AND (p.status = '在籍'::text))))))))))));

drop policy game_player_stat_lines_select on public.game_player_stat_lines;
create policy game_player_stat_lines_select on public.game_player_stat_lines for select
  using (((team_id = current_team_id()) AND (("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) OR (EXISTS ( SELECT 1
   FROM player_guardians pg
  WHERE ((pg.player_id = game_player_stat_lines.player_id) AND (pg.profile_id = (select auth.uid()))))))));

drop policy report_reactions_delete on public.report_reactions;
create policy report_reactions_delete on public.report_reactions for delete
  using ((profile_id = (select auth.uid())));

drop policy report_reactions_insert on public.report_reactions;
create policy report_reactions_insert on public.report_reactions for insert
  with check (((team_id = current_team_id()) AND (profile_id = (select auth.uid())) AND ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) AND (EXISTS ( SELECT 1
   FROM reports r
  WHERE ((r.id = report_reactions.report_id) AND (r.team_id = current_team_id()))))));

drop policy team_analysis_notes_insert on public.team_analysis_notes;
create policy team_analysis_notes_insert on public.team_analysis_notes for insert
  with check (((team_id = current_team_id()) AND ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) AND (author_id = (select auth.uid()))));

drop policy player_analysis_notes_insert on public.player_analysis_notes;
create policy player_analysis_notes_insert on public.player_analysis_notes for insert
  with check (((team_id = current_team_id()) AND ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) AND (author_id = (select auth.uid()))));

drop policy team_analysis_note_reactions_delete on public.team_analysis_note_reactions;
create policy team_analysis_note_reactions_delete on public.team_analysis_note_reactions for delete
  using ((profile_id = (select auth.uid())));

drop policy team_analysis_note_reactions_insert on public.team_analysis_note_reactions;
create policy team_analysis_note_reactions_insert on public.team_analysis_note_reactions for insert
  with check (((team_id = current_team_id()) AND ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) AND (profile_id = (select auth.uid()))));

drop policy player_analysis_note_reactions_delete on public.player_analysis_note_reactions;
create policy player_analysis_note_reactions_delete on public.player_analysis_note_reactions for delete
  using ((profile_id = (select auth.uid())));

drop policy player_analysis_note_reactions_insert on public.player_analysis_note_reactions;
create policy player_analysis_note_reactions_insert on public.player_analysis_note_reactions for insert
  with check (((team_id = current_team_id()) AND ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) AND (profile_id = (select auth.uid()))));

drop policy tab_last_seen_insert on public.tab_last_seen;
create policy tab_last_seen_insert on public.tab_last_seen for insert
  with check ((user_id = (select auth.uid())));

drop policy tab_last_seen_select on public.tab_last_seen;
create policy tab_last_seen_select on public.tab_last_seen for select
  using ((user_id = (select auth.uid())));

drop policy tab_last_seen_update on public.tab_last_seen;
create policy tab_last_seen_update on public.tab_last_seen for update
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy item_last_seen_insert on public.item_last_seen;
create policy item_last_seen_insert on public.item_last_seen for insert
  with check ((user_id = (select auth.uid())));

drop policy item_last_seen_select on public.item_last_seen;
create policy item_last_seen_select on public.item_last_seen for select
  using ((user_id = (select auth.uid())));

drop policy item_last_seen_update on public.item_last_seen;
create policy item_last_seen_update on public.item_last_seen for update
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy report_comments_delete on public.report_comments;
create policy report_comments_delete on public.report_comments for delete
  using ((profile_id = (select auth.uid())));

drop policy report_comments_insert on public.report_comments;
create policy report_comments_insert on public.report_comments for insert
  with check (((team_id = current_team_id()) AND (profile_id = (select auth.uid())) AND ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) AND (EXISTS ( SELECT 1
   FROM reports r
  WHERE ((r.id = report_comments.report_id) AND (r.team_id = current_team_id()))))));

drop policy report_comments_update on public.report_comments;
create policy report_comments_update on public.report_comments for update
  using ((profile_id = (select auth.uid())))
  with check (((profile_id = (select auth.uid())) AND (team_id = current_team_id())));

drop policy daily_reports_delete on public.daily_reports;
create policy daily_reports_delete on public.daily_reports for delete
  using (((team_id = current_team_id()) AND ((author_id = (select auth.uid())) OR ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])))));

drop policy daily_reports_insert on public.daily_reports;
create policy daily_reports_insert on public.daily_reports for insert
  with check (((team_id = current_team_id()) AND (author_id = (select auth.uid()))));

drop policy daily_reports_update on public.daily_reports;
create policy daily_reports_update on public.daily_reports for update
  using (((team_id = current_team_id()) AND ((author_id = (select auth.uid())) OR ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])))))
  with check ((team_id = current_team_id()));

drop policy daily_report_reactions_delete on public.daily_report_reactions;
create policy daily_report_reactions_delete on public.daily_report_reactions for delete
  using ((profile_id = (select auth.uid())));

drop policy daily_report_reactions_insert on public.daily_report_reactions;
create policy daily_report_reactions_insert on public.daily_report_reactions for insert
  with check (((team_id = current_team_id()) AND (profile_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM daily_reports r
  WHERE ((r.id = daily_report_reactions.daily_report_id) AND (r.team_id = current_team_id()))))));

drop policy daily_report_comments_delete on public.daily_report_comments;
create policy daily_report_comments_delete on public.daily_report_comments for delete
  using ((profile_id = (select auth.uid())));

drop policy daily_report_comments_insert on public.daily_report_comments;
create policy daily_report_comments_insert on public.daily_report_comments for insert
  with check (((team_id = current_team_id()) AND (profile_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM daily_reports r
  WHERE ((r.id = daily_report_comments.daily_report_id) AND (r.team_id = current_team_id()))))));

drop policy daily_report_comments_update on public.daily_report_comments;
create policy daily_report_comments_update on public.daily_report_comments for update
  using ((profile_id = (select auth.uid())))
  with check (((profile_id = (select auth.uid())) AND (team_id = current_team_id())));

drop policy report_comment_reactions_delete on public.report_comment_reactions;
create policy report_comment_reactions_delete on public.report_comment_reactions for delete
  using ((profile_id = (select auth.uid())));

drop policy report_comment_reactions_insert on public.report_comment_reactions;
create policy report_comment_reactions_insert on public.report_comment_reactions for insert
  with check (((team_id = current_team_id()) AND (profile_id = (select auth.uid())) AND ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) AND (EXISTS ( SELECT 1
   FROM report_comments c
  WHERE ((c.id = report_comment_reactions.comment_id) AND (c.team_id = current_team_id()))))));

drop policy daily_report_comment_reactions_delete on public.daily_report_comment_reactions;
create policy daily_report_comment_reactions_delete on public.daily_report_comment_reactions for delete
  using ((profile_id = (select auth.uid())));

drop policy daily_report_comment_reactions_insert on public.daily_report_comment_reactions;
create policy daily_report_comment_reactions_insert on public.daily_report_comment_reactions for insert
  with check (((team_id = current_team_id()) AND (profile_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM daily_report_comments c
  WHERE ((c.id = daily_report_comment_reactions.comment_id) AND (c.team_id = current_team_id()))))));

drop policy push_subscriptions_delete on public.push_subscriptions;
create policy push_subscriptions_delete on public.push_subscriptions for delete
  using ((user_id = (select auth.uid())));

drop policy push_subscriptions_insert on public.push_subscriptions;
create policy push_subscriptions_insert on public.push_subscriptions for insert
  with check (((user_id = (select auth.uid())) AND (team_id = current_team_id())));

drop policy push_subscriptions_select on public.push_subscriptions;
create policy push_subscriptions_select on public.push_subscriptions for select
  using ((user_id = (select auth.uid())));

drop policy library_items_delete on public.library_items;
create policy library_items_delete on public.library_items for delete
  using (((team_id = current_team_id()) AND ((uploader_id = (select auth.uid())) OR ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])))));

drop policy library_items_insert on public.library_items;
create policy library_items_insert on public.library_items for insert
  with check (((team_id = current_team_id()) AND (uploader_id = (select auth.uid())) AND ("current_role"() = ANY (ARRAY['一般'::text, '運営'::text, '指導者'::text, '管理者'::text]))));

drop policy library_items_update on public.library_items;
create policy library_items_update on public.library_items for update
  using (((team_id = current_team_id()) AND ((uploader_id = (select auth.uid())) OR ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])))))
  with check (((team_id = current_team_id()) AND ((uploader_id = (select auth.uid())) OR ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])))));

drop policy library_files_delete on public.library_files;
create policy library_files_delete on public.library_files for delete
  using ((EXISTS ( SELECT 1
   FROM library_items i
  WHERE ((i.id = library_files.library_item_id) AND (i.team_id = current_team_id()) AND ((i.uploader_id = (select auth.uid())) OR ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])))))));

drop policy library_files_insert on public.library_files;
create policy library_files_insert on public.library_files for insert
  with check ((EXISTS ( SELECT 1
   FROM library_items i
  WHERE ((i.id = library_files.library_item_id) AND (i.team_id = current_team_id()) AND (i.uploader_id = (select auth.uid()))))));

drop policy game_player_stat_entries_select on public.game_player_stat_entries;
create policy game_player_stat_entries_select on public.game_player_stat_entries for select
  using (((team_id = current_team_id()) AND (("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) OR (EXISTS ( SELECT 1
   FROM player_guardians pg
  WHERE ((pg.player_id = game_player_stat_entries.player_id) AND (pg.profile_id = (select auth.uid()))))))));

drop policy player_skill_test_progress_insert on public.player_skill_test_progress;
create policy player_skill_test_progress_insert on public.player_skill_test_progress for insert
  with check (((team_id = current_team_id()) AND ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) AND (recorded_by = (select auth.uid()))));

drop policy player_skill_test_progress_select on public.player_skill_test_progress;
create policy player_skill_test_progress_select on public.player_skill_test_progress for select
  using (((team_id = current_team_id()) AND (("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) OR (EXISTS ( SELECT 1
   FROM player_guardians pg
  WHERE ((pg.player_id = player_skill_test_progress.player_id) AND (pg.profile_id = (select auth.uid()))))))));

drop policy game_match_notes_insert on public.game_match_notes;
create policy game_match_notes_insert on public.game_match_notes for insert
  with check (((team_id = current_team_id()) AND ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) AND (author_id = (select auth.uid()))));

drop policy game_match_note_reactions_delete on public.game_match_note_reactions;
create policy game_match_note_reactions_delete on public.game_match_note_reactions for delete
  using ((profile_id = (select auth.uid())));

drop policy game_match_note_reactions_insert on public.game_match_note_reactions;
create policy game_match_note_reactions_insert on public.game_match_note_reactions for insert
  with check (((team_id = current_team_id()) AND ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) AND (profile_id = (select auth.uid()))));

drop policy skill_test_promotion_requests_insert on public.skill_test_promotion_requests;
create policy skill_test_promotion_requests_insert on public.skill_test_promotion_requests for insert
  with check (((team_id = current_team_id()) AND (requested_by = (select auth.uid())) AND (status = 'pending'::text) AND (decided_by IS NULL) AND (decided_at IS NULL) AND ("current_role"() = ANY (ARRAY['一般'::text, '運営'::text])) AND (EXISTS ( SELECT 1
   FROM player_guardians pg
  WHERE ((pg.player_id = skill_test_promotion_requests.player_id) AND (pg.profile_id = (select auth.uid())))))));

drop policy skill_test_promotion_requests_select on public.skill_test_promotion_requests;
create policy skill_test_promotion_requests_select on public.skill_test_promotion_requests for select
  using (((team_id = current_team_id()) AND (("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])) OR (requested_by = (select auth.uid())))));

drop policy shooting_drill_records_insert on public.shooting_drill_records;
create policy shooting_drill_records_insert on public.shooting_drill_records for insert
  with check (((team_id = current_team_id()) AND ("current_role"() = ANY (ARRAY['運営'::text, '指導者'::text, '管理者'::text])) AND (recorded_by = (select auth.uid()))));

drop policy shooting_drill_records_select on public.shooting_drill_records;
create policy shooting_drill_records_select on public.shooting_drill_records for select
  using (((team_id = current_team_id()) AND (("current_role"() = ANY (ARRAY['運営'::text, '指導者'::text, '管理者'::text])) OR (EXISTS ( SELECT 1
   FROM player_guardians pg
  WHERE ((pg.player_id = shooting_drill_records.player_id) AND (pg.profile_id = (select auth.uid()))))))));

drop policy shaving_drill_records_insert on public.shaving_drill_records;
create policy shaving_drill_records_insert on public.shaving_drill_records for insert
  with check (((team_id = current_team_id()) AND ("current_role"() = ANY (ARRAY['運営'::text, '指導者'::text, '管理者'::text])) AND (recorded_by = (select auth.uid()))));

drop policy polls_delete on public.polls;
create policy polls_delete on public.polls for delete
  using (((team_id = current_team_id()) AND ((created_by = (select auth.uid())) OR ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])))));

drop policy polls_insert on public.polls;
create policy polls_insert on public.polls for insert
  with check (((team_id = current_team_id()) AND ("current_role"() = ANY (ARRAY['運営'::text, '指導者'::text, '管理者'::text])) AND (created_by = (select auth.uid()))));

drop policy polls_update on public.polls;
create policy polls_update on public.polls for update
  using (((team_id = current_team_id()) AND ((created_by = (select auth.uid())) OR ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])))))
  with check (((team_id = current_team_id()) AND ((created_by = (select auth.uid())) OR ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])))));

drop policy poll_options_delete on public.poll_options;
create policy poll_options_delete on public.poll_options for delete
  using ((EXISTS ( SELECT 1
   FROM polls p
  WHERE ((p.id = poll_options.poll_id) AND (p.team_id = current_team_id()) AND ((p.created_by = (select auth.uid())) OR ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])))))));

drop policy poll_options_insert on public.poll_options;
create policy poll_options_insert on public.poll_options for insert
  with check ((EXISTS ( SELECT 1
   FROM polls p
  WHERE ((p.id = poll_options.poll_id) AND (p.team_id = current_team_id()) AND ((p.created_by = (select auth.uid())) OR ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])))))));

drop policy poll_options_update on public.poll_options;
create policy poll_options_update on public.poll_options for update
  using ((EXISTS ( SELECT 1
   FROM polls p
  WHERE ((p.id = poll_options.poll_id) AND (p.team_id = current_team_id()) AND ((p.created_by = (select auth.uid())) OR ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])))))))
  with check ((EXISTS ( SELECT 1
   FROM polls p
  WHERE ((p.id = poll_options.poll_id) AND (p.team_id = current_team_id()) AND ((p.created_by = (select auth.uid())) OR ("current_role"() = ANY (ARRAY['指導者'::text, '管理者'::text])))))));

drop policy poll_votes_select on public.poll_votes;
create policy poll_votes_select on public.poll_votes for select
  using ((voter_id = (select auth.uid())));

drop policy accounting_approvals_delete on public.accounting_approvals;
create policy accounting_approvals_delete on public.accounting_approvals for delete
  using (((team_id = current_team_id()) AND (EXISTS ( SELECT 1
   FROM accounting_officers ao
  WHERE ((ao.id = accounting_approvals.officer_id) AND (ao.team_id = current_team_id()) AND (ao.user_id = (select auth.uid())))))));

drop policy accounting_approvals_insert on public.accounting_approvals;
create policy accounting_approvals_insert on public.accounting_approvals for insert
  with check (((team_id = current_team_id()) AND (EXISTS ( SELECT 1
   FROM accounting_officers ao
  WHERE ((ao.id = accounting_approvals.officer_id) AND (ao.team_id = current_team_id()) AND (ao.user_id = (select auth.uid())))))));

drop policy accounting_dues_items_select on public.accounting_dues_items;
create policy accounting_dues_items_select on public.accounting_dues_items for select
  using (((team_id = current_team_id()) AND (("current_role"() = ANY (ARRAY['運営'::text, '指導者'::text, '管理者'::text])) OR (EXISTS ( SELECT 1
   FROM ((accounting_dues_billing_periods bp
     JOIN accounting_dues_charges c ON ((c.billing_period_id = bp.id)))
     JOIN player_guardians pg ON ((pg.player_id = c.player_id)))
  WHERE ((bp.dues_item_id = accounting_dues_items.id) AND (pg.profile_id = (select auth.uid()))))))));

drop policy accounting_dues_billing_periods_select on public.accounting_dues_billing_periods;
create policy accounting_dues_billing_periods_select on public.accounting_dues_billing_periods for select
  using ((EXISTS ( SELECT 1
   FROM accounting_dues_items di
  WHERE ((di.id = accounting_dues_billing_periods.dues_item_id) AND (di.team_id = current_team_id()) AND (("current_role"() = ANY (ARRAY['運営'::text, '指導者'::text, '管理者'::text])) OR (EXISTS ( SELECT 1
           FROM (accounting_dues_charges c
             JOIN player_guardians pg ON ((pg.player_id = c.player_id)))
          WHERE ((c.billing_period_id = accounting_dues_billing_periods.id) AND (pg.profile_id = (select auth.uid()))))))))));

drop policy accounting_dues_charges_select on public.accounting_dues_charges;
create policy accounting_dues_charges_select on public.accounting_dues_charges for select
  using ((EXISTS ( SELECT 1
   FROM (accounting_dues_billing_periods bp
     JOIN accounting_dues_items di ON ((di.id = bp.dues_item_id)))
  WHERE ((bp.id = accounting_dues_charges.billing_period_id) AND (di.team_id = current_team_id()) AND (("current_role"() = ANY (ARRAY['運営'::text, '指導者'::text, '管理者'::text])) OR (EXISTS ( SELECT 1
           FROM player_guardians pg
          WHERE ((pg.player_id = accounting_dues_charges.player_id) AND (pg.profile_id = (select auth.uid()))))))))));

commit;
