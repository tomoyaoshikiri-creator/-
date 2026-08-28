begin;

-- CIRCLE LINES本体のバグ修正(Step X-2やCleanupとは独立)。
-- 目的: protect_last_team_admin()(0114)のDELETE分岐が、teams本体の物理削除に伴う
-- team_membershipsへのON DELETE CASCADEと、通常の(teamsを残したままの)明示的な
-- membership削除とを区別していなかったため、正式なチーム削除経路
-- (teamDeletionJob.tsのdelete from teams、7日間の猶予期間後のcron削除)が、
-- 管理者が1名以上いるチーム(=通常運用中のほぼ全チーム)に対して常に失敗していた
-- 不具合を修正する。本番の実測(Step X-2 Cleanup作業中に偶然発見)と、
-- trg_protect_last_team_adminを正しくアタッチした状態でのローカル再現により、
-- この不具合を確認済み。
--
-- 修正方針: DELETE分岐の例外条件に「対応するteams行が現在も実在するか」を追加する。
-- team_memberships.team_idはteams(id)へのon delete cascade付きFKであるため、
-- ある行が存在する限りそのteam_idのteams行は必ず実在する(CASCADE処理中の
-- 一瞬を除く)。teams本体のDELETEはCASCADE発火前に同一トランザクション内で
-- 適用されるため、CASCADE経由でteam_membershipsが削除される時点では
-- teams行は既に存在しない。したがってこの判定により、
--   - teamsを残したまま明示的にmembershipを削除する通常操作は、
--     従来通り最後の管理者を保護する(teams行が実在するため判定に変化なし)
--   - teams本体のCASCADE削除時だけ、最後の管理者membershipの削除も許可する
-- という区別が安全に実現できる。UPDATE分岐(管理者降格)はCASCADEの対象外
-- (ON DELETE CASCADEはUPDATEを引き起こさない)のため変更しない。
--
-- trigger自体(trg_protect_last_team_admin、before update or delete on
-- team_memberships)のDROP/DISABLE/再作成は行わない。関数のシグネチャ
-- (引数なし、returns trigger)も不変のため、create or replaceのみで完結する。
-- SECURITY DEFINER・SET search_path = public・pg_advisory_xact_lockによる
-- 排他制御は既存のまま維持する。既存データへのINSERT/UPDATE/DELETEは行わない。

create or replace function public.protect_last_team_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(
    ('x' || substr(md5(coalesce(new.team_id, old.team_id)::text), 1, 16))::bit(64)::bigint
  );

  if tg_op = 'DELETE' then
    if old.role = '管理者'
       and (select count(*) from public.team_memberships where team_id = old.team_id and role = '管理者') <= 1
       and exists (select 1 from public.teams where id = old.team_id) then
      raise exception '管理者は最低1名必要です。';
    end if;
    return old;
  end if;

  if new.team_id is distinct from old.team_id or new.user_id is distinct from old.user_id then
    raise exception 'team_memberships.team_id/user_idの変更は許可されていません。';
  end if;

  if old.role = '管理者' and new.role <> '管理者' then
    if (select count(*) from public.team_memberships where team_id = old.team_id and role = '管理者') <= 1 then
      raise exception '管理者は最低1名必要です。';
    end if;
  end if;
  return new;
end;
$$;

commit;
