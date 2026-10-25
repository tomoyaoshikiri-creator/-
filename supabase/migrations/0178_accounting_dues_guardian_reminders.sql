begin;

-- 会計機能 フェーズ5-3(未納一覧・未納通知・保護者向け閲覧画面)。
-- フェーズ5-1(項目設定)・5-2(請求自動生成・入金チェック)の続き。
-- 保護者(一般)が自分の子どもの集金状況(未納/入金済み・金額)だけを閲覧できるようにする。
-- accounting_dues_player_settings・accounting_dues_grade_bands(他の家庭の免除・個別金額など
-- 個人情報を含む)は従来通り運営以上限定のまま変更しない。

drop policy accounting_dues_items_select on public.accounting_dues_items;
create policy accounting_dues_items_select on public.accounting_dues_items for select
  using (
    team_id = public.current_team_id()
    and (
      public.current_role() in ('運営', '指導者', '管理者')
      or exists (
        select 1
        from public.accounting_dues_billing_periods bp
        join public.accounting_dues_charges c on c.billing_period_id = bp.id
        join public.player_guardians pg on pg.player_id = c.player_id
        where bp.dues_item_id = accounting_dues_items.id and pg.profile_id = auth.uid()
      )
    )
  );

drop policy accounting_dues_billing_periods_select on public.accounting_dues_billing_periods;
create policy accounting_dues_billing_periods_select on public.accounting_dues_billing_periods for select
  using (
    exists (
      select 1 from public.accounting_dues_items di
      where di.id = dues_item_id and di.team_id = public.current_team_id()
        and (
          public.current_role() in ('運営', '指導者', '管理者')
          or exists (
            select 1
            from public.accounting_dues_charges c
            join public.player_guardians pg on pg.player_id = c.player_id
            where c.billing_period_id = accounting_dues_billing_periods.id and pg.profile_id = auth.uid()
          )
        )
    )
  );

drop policy accounting_dues_charges_select on public.accounting_dues_charges;
create policy accounting_dues_charges_select on public.accounting_dues_charges for select
  using (
    exists (
      select 1 from public.accounting_dues_billing_periods bp
      join public.accounting_dues_items di on di.id = bp.dues_item_id
      where bp.id = billing_period_id and di.team_id = public.current_team_id()
        and (
          public.current_role() in ('運営', '指導者', '管理者')
          or exists (
            select 1 from public.player_guardians pg
            where pg.player_id = accounting_dues_charges.player_id and pg.profile_id = auth.uid()
          )
        )
    )
  );

-- 未納の自動通知(メールフォールバック)用のイベント種別を追加する。
alter table public.email_notifications drop constraint email_notifications_event_type_check;
alter table public.email_notifications add constraint email_notifications_event_type_check check (event_type in (
  'invite_issued',
  'attendance_deadline',
  'billing_payment_failed',
  'team_deletion_warning',
  'dues_unpaid_reminder'
));

commit;
