# 下部表示の実機計測

このブランチは修正前の計測用です。mainのレイアウトCSSとviewport設定を保ち、入力クラッシュ診断ブランチの変更を含めません。

## ログイン不要の手順

1. プレビューの `/auth/viewport-check?viewport_debug=1` をSafariで開く。
2. まずSafari通常タブで、計測表示の「本文・サイドバーを最下部へ」を押してスクリーンショットを撮る。
3. 共有からホーム画面へ追加し、追加した「CL表示確認」のアイコンから起動する。
4. iPad miniを横向きにし、同じボタンを押してスクリーンショットを撮る。

専用manifestのstart_urlは診断ページです。ログインや個人データの入力は不要です。スクロールの操作は利用者がボタンを押した時だけ行います。計測表示はVercel Preview環境でのみ有効です。

## 判別する値

- `mode` が browser / standalone のどちらか。
- screen、innerHeight、clientHeight、visualViewport.height、vh/svh/dvh/lvh、Safe Area。
- app-shell、本文、サイドバーのtop/height/bottom。
- `scroll=現在位置/最大位置` が最下部まで達しているか。
- 本文最下部の枠の下辺まで表示されているか。

screenとDOMの高さの差だけではOSの予約領域と断定しません。画面のピクセル位置、起動方法、上端のステータスバー、shellとスクロール要素の実測を合わせて評価します。

測定はDOM寸法のみです。本文、入力値、認証情報、Cookie、storageを読まず、結果を保存・送信しません。

## 検証

`next typegen`、`tsc --noEmit`、変更TSXファイルのESLintが成功。ローカルブラウザ取得は配信zipの破損で失敗したため、実機表示とOS固有の挙動は未検証です。修正完了とは扱いません。
