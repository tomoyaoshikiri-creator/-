-- 出欠一覧(AttendanceRosterModal)を全ロールが見られるようにする。
-- playersテーブルは選手一覧タブ保護のため指導者・管理者(+紐付けられた自分の子ども)のみ閲覧可のままとし、
-- 出欠一覧に必要な最小限のフィールドだけをSECURITY DEFINER関数経由で全ロールに公開する。
create or replace function public.list_roster_players()
returns table (id uuid, sei text, mei text, grade text, status text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.sei, p.mei, p.grade, p.status
  from public.players p
  where p.team_id = public.current_team_id()
    and p.status = '在籍';
$$;

grant execute on function public.list_roster_players() to authenticated;

-- attendancesにDELETEポリシーが無く誰も削除できなかったため追加する。
-- 管理者は全員分、本人(紐付けられた選手分を含む)は自分の登録分のみ削除できる(UPDATEポリシーと同じ条件)。
create policy attendances_delete on public.attendances for delete
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
