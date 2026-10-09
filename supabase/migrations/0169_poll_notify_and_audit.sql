begin;

-- 投票機能(0166)の未実装2点を追加する(クラウド指示書 N-1)。
-- 1. 作成時のプッシュ通知は既存の/api/push/notify側で対応するため、ここではDB側の
--    変更は不要(allowed_rolesはpollsに既存のカラムをそのまま使う)。
-- 2. Signature Editionの管理者が、匿名投票・締切前に特例で投票者名まで閲覧した操作を
--    audit_logsに記録する。対象投票のIDのみを記録し、投票者名は記録しない。

alter table public.audit_logs drop constraint audit_logs_action_check;
alter table public.audit_logs add constraint audit_logs_action_check check (action in (
  'role_changed',
  'invite_issued',
  'invite_revoked',
  'member_removed',
  'team_leave',
  'team_deletion_requested',
  'ai_analysis_generated',
  'billing_plan_changed',
  'billing_subscription_canceled',
  'data_export',
  'players_bulk_imported',
  'poll_voter_identity_viewed'
));

-- poll_results()を再定義し、特例(v_allow_early)が実際に意味を持った場合
-- (締切前、または匿名投票)のみ記録する。通常のスタッフと同じ見え方になる場合
-- (締切済みかつ匿名でない投票)は記録しない。ロジックはこの点の追加以外変更しない。
create or replace function public.poll_results(p_poll_id uuid)
returns table (option_id uuid, option_label text, vote_count bigint, voter_ids uuid[])
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_poll record;
  v_team_plan text;
  v_reveal_voters boolean;
  v_allow_early boolean;
begin
  select * into v_poll from public.polls where id = p_poll_id and team_id = public.current_team_id();
  if v_poll is null then
    raise exception '投票が見つかりません';
  end if;

  select plan into v_team_plan from public.teams where id = v_poll.team_id;
  v_allow_early := (public.current_role() = '管理者' and v_team_plan = 'signature_edition');

  if not v_allow_early and v_poll.status <> 'closed' then
    return;
  end if;

  v_reveal_voters := v_allow_early or not v_poll.anonymous;

  if v_allow_early and (v_poll.anonymous or v_poll.status <> 'closed') then
    perform public.record_audit_event(v_poll.team_id, 'poll_voter_identity_viewed', 'poll', p_poll_id);
  end if;

  return query
    select
      o.id,
      o.label,
      count(v.id),
      case when v_reveal_voters then array_agg(v.voter_id) filter (where v.voter_id is not null) else null end
    from public.poll_options o
    left join public.poll_votes v on v.option_id = o.id
    where o.poll_id = p_poll_id
    group by o.id, o.label, o.position
    order by o.position;
end;
$$;

commit;
