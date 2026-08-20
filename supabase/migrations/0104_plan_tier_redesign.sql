-- プラン体系再設計。既存5プラン(お試し/中間/フル/フルプラス/Max)のDB値・料金体系は
-- 変更せず、非売品の新プラン2種を追加する。
--   max_partner       … モニター・開発協力チーム向け(運営が手動付与、一般UI非公開)
--   signature_edition … 都賀ビクトリーズ専用の完全非売品(運営が手動付与、一般UI非公開)
-- このmigrationは既存チームのplan値を一切変更しない(都賀ビクトリーズのplanを
-- MaxからSignature Editionへ切り替える作業は、別途手動で行う)。

-- 1. teams_plan_checkに新2プランを追加する(0093と同じく、制約名がずれていても
--    確実に対象を特定できるよう定義文のパターンマッチで既存制約を探して置き換える)。
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.teams'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%(plan =%';
  if cname is not null then
    execute format('alter table public.teams drop constraint %I', cname);
  end if;
end $$;

alter table public.teams add constraint teams_plan_check
  check (plan in ('お試し', '中間', 'フル', 'フルプラス', 'Max', 'max_partner', 'signature_edition'));

-- 2. storage_limit_bytes自動算出トリガーに新2プランを追加する(いずれもMaxと同じ10GiB)。
--    あわせて、CHECK制約をすり抜けた万一の未知プラン値に対しては、これまでの
--    「該当するwhenが無ければ黙ってNULLになる」という挙動をやめ、原因が追いにくい
--    NOT NULL違反ではなく、プラン名を含む明示的なエラーで即座に失敗させる
--    (このガードの追加以外、既存プランの算出ロジック自体は変更していない)。
create or replace function public.sync_team_storage_limit()
returns trigger
language plpgsql
as $$
begin
  new.storage_limit_bytes := case new.plan
    when 'お試し' then 104857600        -- 100MiB
    when '中間' then 1073741824         -- 1GiB
    when 'フル' then 5368709120         -- 5GiB
    when 'フルプラス' then 5368709120     -- 5GiB(フルと同じ)
    when 'Max' then 10737418240         -- 10GiB
    when 'max_partner' then 10737418240 -- 10GiB(Maxと同じ)
    when 'signature_edition' then 10737418240 -- 10GiB(Maxと同じ)
  end;
  if new.storage_limit_bytes is null then
    raise exception '不明なプラン値のためstorage_limit_bytesを算出できません: %', new.plan;
  end if;
  return new;
end;
$$;

-- 3. 検定機能(skill_tests/player_skill_test_progress)のプラン限定を、
--    Max単独からMax/Max Partner/Signature Editionの3プランへ拡張する。
create or replace function public.enforce_skill_test_max_plan()
returns trigger
language plpgsql
as $$
declare
  team_plan text;
begin
  select plan into team_plan from public.teams where id = new.team_id;
  if team_plan not in ('Max', 'max_partner', 'signature_edition') then
    raise exception '検定機能はMax/Max Partner/Signature Edition限定です';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_skill_test_progress_max_plan()
returns trigger
language plpgsql
as $$
declare
  team_plan text;
begin
  select plan into team_plan from public.teams where id = new.team_id;
  if team_plan not in ('Max', 'max_partner', 'signature_edition') then
    raise exception '検定機能はMax/Max Partner/Signature Edition限定です';
  end if;
  return new;
end;
$$;

-- 4. sports_test_records(スポーツテスト記録)には、これまでDBレベルのプラン制限が
--    存在せず、skill_testsと異なりteam_id/role RLSのみで守られていた(セキュリティ上の
--    ギャップ)。既存のRLSポリシーは変更せず、skill_testsと同じ考え方で
--    「書き込み(insert/update)時にチームがMax/Max Partner/Signature Editionか」を
--    検証するトリガーだけを追加する。
create or replace function public.enforce_sports_test_max_plan()
returns trigger
language plpgsql
as $$
declare
  team_plan text;
begin
  select plan into team_plan from public.teams where id = new.team_id;
  if team_plan not in ('Max', 'max_partner', 'signature_edition') then
    raise exception 'スポーツテスト機能はMax/Max Partner/Signature Edition限定です';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_sports_test_max_plan_trigger on public.sports_test_records;
create trigger enforce_sports_test_max_plan_trigger
before insert or update on public.sports_test_records
for each row execute function public.enforce_sports_test_max_plan();

-- 5. signature_editionは都賀ビクトリーズ専用の完全非売品プラン。teams.planへの書き込み
--    自体は既存のprotect_team_billing_columns(authenticatedロールからのbilling列書き込みを
--    一律拒否するトリガー、0083/0096で定義)がすでに防いでいるが、service_role/postgres経由の
--    運用ミスにも備え、defense-in-depthとしてsignature_editionが都賀ビクトリーズ以外の
--    チームに付与されることをDBレベルでも拒否するトリガーを追加する。
--
--    アプリコード側にteam_idをハードコードしないのと同じ考え方で、このmigration自体にも
--    実team_idの文字列は直接書かない。実行時に「都賀ビクトリーズ」という名前のチームが
--    一意に特定できることを確認したうえで、そのidだけをガード関数の定義に埋め込む
--    (関数側は今後チーム名が変更されても影響を受けないよう、名前ではなくこの時点で
--    確認したidをそのまま比較に使う)。一意に特定できない場合はmigration全体を中断する。
do $migration$
declare
  target_team_id uuid;
  match_count int;
begin
  select count(*) into match_count from public.teams where name = '都賀ビクトリーズ';
  if match_count <> 1 then
    raise exception 'signature_edition保護の対象チームを一意に特定できません(名前「都賀ビクトリーズ」に一致するチーム数: %)。migrationを中断しました。対象チームの状態を確認してから再実行してください。', match_count;
  end if;

  select id into target_team_id from public.teams where name = '都賀ビクトリーズ';

  execute format($fn$
    create or replace function public.enforce_signature_edition_team()
    returns trigger
    language plpgsql
    as $body$
    begin
      if new.plan = 'signature_edition' and new.id <> %L then
        raise exception 'signature_editionプランは都賀ビクトリーズ専用です';
      end if;
      return new;
    end;
    $body$;
  $fn$, target_team_id);
end
$migration$;

drop trigger if exists enforce_signature_edition_team_trigger on public.teams;
create trigger enforce_signature_edition_team_trigger
before insert or update of plan on public.teams
for each row execute function public.enforce_signature_edition_team();
