begin;

-- 年度更新(advance_academic_year)で卒団した選手に紐づく保護者のうち、ロールが「運営」で
-- かつ他に在籍中(status='在籍')の選手との紐づけが無い人は「一般」に下げる(ユーザー指示)。
-- 指導者・管理者は対象外(保護者兼コーチのような人の役職を奪わないため)。既存の運営には
-- 遡って適用せず、この変更以降の年度更新からの適用とする。
-- きょうだいが複数いて一部だけ卒団した場合は、他の子がまだ在籍していれば運営のまま維持する
-- (在籍中の選手が1人もいなくなった場合のみ一般に下げる)。
create or replace function public.advance_academic_year()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid := public.current_team_id();
  rl text := public.current_role();
  cat text;
  grad_grade int;
  v_graduating_ids uuid[];
  v_guardian_user_id uuid;
begin
  if tid is null or coalesce(rl, '') not in ('指導者', '管理者') then
    raise exception '権限がありません';
  end if;

  select category into cat from public.teams where id = tid;
  if cat = 'その他' then
    return;
  end if;

  grad_grade := case cat
    when '小学生' then 6
    when '中学生' then 9
    when '高校生' then 12
    when '大学生' then 16
  end;

  -- 今回の更新で卒団する選手(今の時点ではまだstatus更新前)のIDを控えておく。
  select array_agg(id) into v_graduating_ids
    from public.players
    where team_id = tid and status <> 'OB・OG' and grade = grad_grade::text;

  -- 既にOB・OGの選手は、卒団からの経過年数として学年を+1する
  update public.players
    set grade = (grade::int + 1)::text
    where team_id = tid and status = 'OB・OG' and grade is not null;

  -- 卒業学年の選手は今回の年度更新でOB・OGへ卒団する(学年はこの回はまだ卒業学年のまま)
  update public.players
    set status = 'OB・OG'
    where team_id = tid and status <> 'OB・OG' and grade = grad_grade::text;

  -- 在籍中(卒業学年未満)の学年を+1する
  update public.players
    set grade = (grade::int + 1)::text
    where team_id = tid and status <> 'OB・OG' and grade is not null and grade::int < grad_grade;

  -- 卒団した選手に紐づく保護者のうち、運営ロールでかつ在籍中の選手との紐づけが
  -- もう無い人を一般に下げる(role_changedとして監査ログにも記録する)。
  if v_graduating_ids is not null then
    for v_guardian_user_id in
      select distinct tm.user_id
      from public.team_memberships tm
      where tm.team_id = tid
        and tm.role = '運営'
        and exists (
          select 1 from public.player_guardians pg
          where pg.profile_id = tm.user_id and pg.player_id = any(v_graduating_ids)
        )
        and not exists (
          select 1
          from public.player_guardians pg2
          join public.players p2 on p2.id = pg2.player_id
          where pg2.profile_id = tm.user_id and p2.team_id = tid and p2.status = '在籍'
        )
    loop
      update public.team_memberships set role = '一般' where team_id = tid and user_id = v_guardian_user_id;
      perform public.record_audit_event(
        tid, 'role_changed', 'team_membership', v_guardian_user_id,
        jsonb_build_object('from_role', '運営', 'to_role', '一般', 'reason', 'graduation')
      );
    end loop;
  end if;
end;
$$;

commit;
