begin;

-- シェービングドリルは選手個人ではなくチーム全体で行う練習のため、記録に特定の
-- 選手を紐づける意味がない。player_id列を廃止し、選手選択欄・選手での絞り込みを
-- UIからも削除する(ユーザー指示)。
--
-- 閲覧権限:カルテ(ワークアウト配下含む)自体がスタッフ(指導者・管理者)限定の
-- ページのため(canViewKarte)、これまでの「一般・運営は紐づく選手の閲覧のみ」
-- という分岐は選手との紐づけが無くなったことで成立しなくなる。登録・編集・削除と
-- 同じスタッフ限定に統一する。

drop policy shaving_drill_records_select on public.shaving_drill_records;
create policy shaving_drill_records_select on public.shaving_drill_records for select
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
  );

drop index if exists public.shaving_drill_records_team_player_date_idx;

alter table public.shaving_drill_records drop column player_id;

create index shaving_drill_records_team_date_idx
  on public.shaving_drill_records (team_id, recorded_on desc);

commit;
