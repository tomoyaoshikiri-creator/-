-- カスタムスタッツ項目に、チーム集計時の意味(合計として見るべきか、平均として見るべきか、
-- 割合・率か、指定しないか)を追加できるようにする。既存項目のaggregation_typeは推測して
-- 自動設定せず、全てnull(未設定)のまま追加する(未設定の場合、AI分析側は「この項目の
-- チーム集計方法は定義されていない」として、合計・平均どちらの意味を持つか断定しない)。

alter table public.team_stat_categories
  add column aggregation_type text
    check (aggregation_type in ('SUM', 'AVERAGE', 'RATE', 'NEUTRAL'));
