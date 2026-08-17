-- AI分析の生成結果を、専用テーブル(player_ai_analysis/team_ai_analysis)ではなく
-- 既存の「選手分析フィードバック」「チーム分析フィードバック」のタイムラインに
-- 統合する。sourceカラムで人間の投稿('staff')とAI生成('ai')を区別する。

alter table public.team_analysis_notes
  add column source text not null default 'staff' check (source in ('staff', 'ai'));
alter table public.player_analysis_notes
  add column source text not null default 'staff' check (source in ('staff', 'ai'));

drop table public.player_ai_analysis;
drop table public.team_ai_analysis;
