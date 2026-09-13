# 負荷試験(k6)

`docs/load-handling-todo.md`に記載していた「実際の負荷試験(未実施)」を埋めるための
[k6](https://k6.io/)スクリプト。CIには組み込んでいない(実行判断・対象環境は都度、
人間が決めるべきもののため)。

## ⚠️ 実行前に必ず確認すること

- **本番ドメインに向けて実行する前に、必ず人間の承認を得ること。** アクセス集中により
  Vercel/Supabase側の利用量・料金に影響したり、実際のユーザー体験を悪化させたりする
  可能性がある。
- `authenticated-browse.js`は実際にログインするため、**負荷試験専用に用意したテスト
  アカウント・テストチーム**を使うこと。本番ユーザーの認証情報を絶対に使わない。
- どちらのスクリプトも読み取り(GET)のみで、データの作成・更新・削除は行わない。

デフォルトの`BASE_URL`は`http://localhost:3000`(ローカル開発サーバー)。他の環境に
向けるときは`-e BASE_URL=...`で明示的に指定する(指定しない限り、うっかり他環境に
アクセスすることはない)。

## セットアップ

k6本体のインストールが必要(このリポジトリのnpm依存には含めていない):
<https://k6.io/docs/get-started/installation/>

## スクリプト

### `k6/public-pages.js` — 未ログインの公開ページ

LP・料金ページ・ログイン/サインアップ画面・利用規約等、認証不要なページへの負荷試験。
書き込みが一切発生しないため、対象環境さえ承認が取れていればそのまま実行できる。

```sh
k6 run loadtest/k6/public-pages.js -e BASE_URL=http://localhost:3000
```

### `k6/authenticated-browse.js` — ログイン後の一覧画面

ホーム・お知らせ・チーム日報・コーチ日報・選手一覧・予定・予定履歴・試合結果・ライブラリ・
カルテ(チーム)など、`docs/load-handling-todo.md`で指摘している「`.limit()`なしで
全件取得している一覧画面」を中心に、ログイン後の読み取り主体の画面を巡回する。

```sh
k6 run loadtest/k6/authenticated-browse.js \
  -e BASE_URL=http://localhost:3000 \
  -e LOAD_TEST_EMAIL=loadtest@example.com \
  -e LOAD_TEST_PASSWORD=xxxxxxxx
```

ログインは実際のログインフォーム(JS無効時のプログレッシブエンハンスメント経由の
HTML `<form>` POST)を1回だけ実行し、発行されたセッションCookieを全VUで使い回す
(VUごとにブラウザを起動するような重い方式は取らない)。

## 共通の環境変数

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:3000` | 対象環境 |
| `TARGET_VUS` | `20`(public-pages) / `10`(authenticated-browse) | ピーク時の仮想ユーザー数 |

## 結果の見方

k6の標準出力に`http_req_duration`(応答時間)・`http_req_failed`(失敗率)等が
サマリ表示される。両スクリプトとも`thresholds`でp95応答時間・失敗率の目安を設定して
いるが、この数値自体は仮の目安であり、実際のインフラ構成やチーム規模の想定に応じて
見直すこと。

負荷試験の結果、`docs/load-handling-todo.md`の「一覧画面のページングなし」の項目
(未対応が残っている画面がないか)や、B-10で追加したインデックスが効いているかを
実測で確認できる。
