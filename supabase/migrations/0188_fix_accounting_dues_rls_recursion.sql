begin;

-- accounting_dues_items / accounting_dues_billing_periods のSELECTポリシーが
-- 互いを直接EXISTS参照し合う循環構造になっており、「infinite recursion detected in
-- policy for relation "accounting_dues_billing_periods"」エラーが発生していた
-- (集金項目の保存は insert().select() で直後にSELECTポリシーが評価されるため、
-- 運営以上が集金項目を新規登録するたびに確実に再現する)。
--
-- 循環の構造:
--   accounting_dues_items_select
--     → exists(... from accounting_dues_billing_periods bp ...)
--   accounting_dues_billing_periods_select
--     → exists(... from accounting_dues_items di ...)        (①items側へ戻る)
--     → exists(... from accounting_dues_charges c ...)       (②charges経由でも戻る)
--   accounting_dues_charges_select
--     → exists(... from accounting_dues_billing_periods bp ...) (③billing_periods側へ戻る)
--
-- 保護者(一般)向けの「自分の子の集金だけ見える」判定(player_guardians経由)を、
-- RLSが掛かったテーブルへの直接EXISTS参照からSECURITY DEFINER関数呼び出しに置き換える。
-- SECURITY DEFINER関数は呼び出し元のRLSを経由せずに内部で直接テーブルを読むため、
-- ポリシー同士の循環参照を断ち切れる(team_sports_test_averages等、既存の
-- ガーディアン向け集計関数と同じ方針)。

create function public.guardian_sees_dues_item(p_dues_item_id uuid) returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from accounting_dues_billing_periods bp
    join accounting_dues_charges c on c.billing_period_id = bp.id
    join player_guardians pg on pg.player_id = c.player_id
    where bp.dues_item_id = p_dues_item_id and pg.profile_id = auth.uid()
  )
$$;
grant execute on function public.guardian_sees_dues_item(uuid) to authenticated;

create function public.guardian_sees_dues_billing_period(p_billing_period_id uuid) returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from accounting_dues_charges c
    join player_guardians pg on pg.player_id = c.player_id
    where c.billing_period_id = p_billing_period_id and pg.profile_id = auth.uid()
  )
$$;
grant execute on function public.guardian_sees_dues_billing_period(uuid) to authenticated;

-- DROP POLICY + CREATE POLICYではなくALTER POLICY ... USINGで既存ポリシーのUSING句
-- だけ差し替える(DROPを伴う操作を避ける)。
alter policy accounting_dues_items_select on public.accounting_dues_items
  using (
    team_id = public.current_team_id()
    and (
      public.current_role() in ('運営', '指導者', '管理者')
      or public.guardian_sees_dues_item(id)
    )
  );

alter policy accounting_dues_billing_periods_select on public.accounting_dues_billing_periods
  using (
    exists (
      select 1 from public.accounting_dues_items di
      where di.id = dues_item_id and di.team_id = public.current_team_id()
        and (
          public.current_role() in ('運営', '指導者', '管理者')
          or public.guardian_sees_dues_billing_period(accounting_dues_billing_periods.id)
        )
    )
  );

-- accounting_dues_charges_selectはbilling_periods→itemsの一方向参照のみで、
-- 上の修正によりitems/billing_periods側がcharges/互いへ戻らなくなったため、
-- 変更しなくても循環は解消する(③の経路はbilling_periods側の②を断ち切ったことで消える)。

commit;
