begin;

-- 0157で「検定は級・段を問わず必ず承認を経てから反映」に統一したが、指導者・管理者自身の
-- 申請については承認不要で即座に反映してほしいとの要望を受け、スタッフだけは直接反映に戻す。
-- 一般・運営からの申請は引き続きskill_test_promotion_requestsの承認(pending→approved)を
-- 経て初めて反映される(0157のまま)。

-- 指導者・管理者はplayer_skill_test_progressへ直接insertできるようにする
-- (一般・運営は引き続き直接insertできない。申請経由のみ)。
create policy player_skill_test_progress_insert on public.player_skill_test_progress for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
    and recorded_by = auth.uid()
  );

-- 指導者・管理者は自身の直接反映のみを行い、skill_test_promotion_requestsの申請フロー自体は
-- 経由しなくなったため、申請insertポリシーを一般・運営限定に戻す
-- (承認・却下(update)は引き続き指導者・管理者なら誰でも行える。0157のまま変更なし)。
drop policy if exists skill_test_promotion_requests_insert on public.skill_test_promotion_requests;
create policy skill_test_promotion_requests_insert on public.skill_test_promotion_requests for insert
  with check (
    team_id = public.current_team_id()
    and requested_by = auth.uid()
    and status = 'pending'
    and decided_by is null
    and decided_at is null
    and public.current_role() in ('一般', '運営')
    and exists (
      select 1 from public.player_guardians pg
      where pg.player_id = skill_test_promotion_requests.player_id and pg.profile_id = auth.uid()
    )
  );

commit;
