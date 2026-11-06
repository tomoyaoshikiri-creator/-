begin;

-- NEWS機能拡張: 「表示対象年月」と「関連予定」を追加する。
-- 既存の予定テーブル(schedules)は変更しない。既存NEWSの件数・本文・公開設定・
-- 登録日時は変更しない。

-- 1) 表示対象年月。まず一旦NULL許容で追加し、既存行には従来の表示月
--    (created_atの年月)を設定してからNOT NULL制約を付ける。
alter table public.notices
  add column display_year_month text;

update public.notices
set display_year_month = to_char(created_at, 'YYYY-MM')
where display_year_month is null;

alter table public.notices
  alter column display_year_month set not null,
  -- アプリ側(NewNoticeModal.tsx等)は常にdisplay_year_monthを明示的に送るため、
  -- このDEFAULTは万一指定漏れがあった場合の安全弁に過ぎない。ただし発動した場合に
  -- 無意味な値にならないよう、アプリが「現在月」を判定する基準(ブラウザのローカル
  -- 時刻、実運用上は日本時間)に合わせてAsia/Tokyoで計算する。セッションのデフォルト
  -- タイムゾーンはUTCのため(確認済み)、明示しないとUTCの月初め9時間がずれる。
  -- 既存行の一括移行(直後のUPDATE文)はこの変更の影響を受けない
  -- (DEFAULTは新規INSERT/今後の省略時のみに作用し、既存データには遡って適用されない)。
  alter column display_year_month set default to_char(now() AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM');

alter table public.notices
  add constraint notices_display_year_month_format
  check (display_year_month ~ '^\d{4}-(0[1-9]|1[0-2])$');

-- 2) 関連予定(任意、1件のみ)。予定が削除された場合はNEWS本体を残したまま
--    紐づけのみ解除する(on delete set null)。1件の予定に複数のNEWSを
--    紐づけられるため、UNIQUE制約は付けない。既存NEWSの関連予定は未設定(NULL)のまま。
alter table public.notices
  add column related_schedule_id uuid references public.schedules(id) on delete set null;

create index notices_display_year_month_idx on public.notices (team_id, display_year_month);
create index notices_related_schedule_id_idx on public.notices (related_schedule_id) where related_schedule_id is not null;

-- 3) 紐づけ可能なのは同一チーム内の既存予定のみ、という制約はFKだけでは表現できない
--    (team_idはテーブルをまたぐ)ため、保存時にサーバー側(DBトリガー)で検証する。
--    クライアント側の検証だけに頼らない多層防御(会計機能のenforce_accounting_plan等と
--    同じ方針)。
create or replace function public.validate_notice_related_schedule_team()
returns trigger
language plpgsql
as $$
begin
  if new.related_schedule_id is not null then
    if not exists (
      select 1 from public.schedules s
      where s.id = new.related_schedule_id
        and s.team_id = new.team_id
    ) then
      -- クライアント側でこの文字列を見て「予定の再選択/紐づけ解除を促す」表示に
      -- 分岐できるよう、判別しやすいプレフィックスを付けておく。
      raise exception 'RELATED_SCHEDULE_INVALID: related_schedule_id must reference a schedule in the same team';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists notices_validate_related_schedule_team on public.notices;
create trigger notices_validate_related_schedule_team
  before insert or update of related_schedule_id, team_id on public.notices
  for each row execute function public.validate_notice_related_schedule_team();

commit;
