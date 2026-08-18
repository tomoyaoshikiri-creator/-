-- カスタムスタッツ項目(バスケットボール・ミニバスケットボール以外の競技向け)に、
-- 単位・説明・評価方向(高い方が良い/低い方が良い/どちらでもない)を追加できるようにする。
-- 既存項目の評価方向を推測して自動設定することはせず、全てnull(未設定)のまま追加する
-- (未設定の場合、AI分析側は「評価方向不明」として断定的な評価を避ける)。
-- 将来的にスタッツ項目設定画面(game/stat-categories)からユーザーが設定できるようにする想定。

alter table public.team_stat_categories
  add column evaluation_direction text
    check (evaluation_direction in ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'NEUTRAL')),
  add column unit text,
  add column description text;
