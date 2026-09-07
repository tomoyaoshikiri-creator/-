-- notice_attachmentsにPDFサムネイル画像の保存先を追加する。
-- サムネイルは元ファイルと同じStorageバケット/フォルダ構成に保存するため、
-- 既存のRLSポリシー(notice_attachments_storage_select/_insert、0001/0058/0082)を
-- そのまま利用でき、ポリシーの追加変更は不要。
alter table public.notice_attachments
  add column thumbnail_path text;
