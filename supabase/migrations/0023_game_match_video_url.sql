-- 試合(game_matches)に振り返り用の動画URL(YouTube等)を記録できるようにする。
alter table public.game_matches add column video_url text;
