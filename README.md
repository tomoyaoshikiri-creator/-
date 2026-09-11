# CIRCLE LINES

少年スポーツチーム向けのチーム運営アプリ。予定・出欠管理、お知らせ、練習日報・コーチ日報、選手マスタ・選手メモ、試合記録・スタッツ、CLUB KARTE(選手カルテ・チームカルテ・スポーツテスト・検定)、ライブラリ(資料共有)、ユーザー管理を1つのアプリにまとめている。チームIDによる完全なマルチテナント設計で、`/signup`から誰でも新しいチームを作成して利用を開始できる(公開ランディングページ`/`・料金ページ`/pricing`経由)。都賀ビクトリーズ向けには非売品の専用プラン(signature_edition)を提供している。

技術構成: Next.js (App Router) + TypeScript + Tailwind CSS / Supabase (Postgres + Auth + Storage、Row Level Securityでチームごとにデータを分離) / Stripe(有料プランの課金) / Resend(重要通知のメールフォールバック) / Sentry(サーバーエラー監視、`@sentry/node`) / GitHub Actions(CI: 型チェック・lint・テスト・ビルド、およびpgTAPによるRLSテスト)。

運用に関する詳細(環境変数一覧・デプロイ手順・監視・インシデント対応)は [`docs/runbook.md`](docs/runbook.md) を参照。

## セットアップ手順

### 1. Supabaseプロジェクトを作成する

1. https://supabase.com でプロジェクトを新規作成する
2. プロジェクトのダッシュボード → SQL Editor を開き、`supabase/migrations/` 配下のファイルを**番号順に**貼り付けて実行する。各ファイル冒頭のコメントに、そのマイグレーションで何を変更したかを記載している(スキーマ・RLSポリシー・トリガー・RPC関数・Storageバケットの追加/変更が中心)
3. ダッシュボード → Project Settings → API から `Project URL` と `anon public`(または新しいPublishable key)を控える

Supabase CLIがある場合は、SQL Editorの代わりに以下でも適用できる。

```bash
supabase link --project-ref <project-ref>
supabase db push
```

### 2. 環境変数を設定する

`.env.local.example` を `.env.local` にコピーし、手順1で控えた値を設定する。

```bash
cp .env.local.example .env.local
```

必須なのはSupabaseの2つの値のみ。それ以外(service_role・Web Push・Stripe・Resend・Sentry・AI分析)は未設定でも機能が静かに無効化されるだけでアプリ自体は動作する。各変数の詳細な用途は`.env.local.example`内のコメント、または[`docs/runbook.md`](docs/runbook.md)の環境変数一覧を参照。

### 3. 依存関係のインストールと起動

```bash
npm install
npm run dev
```

http://localhost:3000 を開くと未ログイン時は公開ランディングページ(`/`)が表示される。「無料で始める」(`/signup`)からアカウントを作成し、チーム名と管理者情報を入力すると、そのチームの最初の管理者としてログインできる。以降のメンバーは、ユーザー管理タブから発行した招待リンク経由で自分自身のアカウントを作成する。

Supabaseプロジェクトの「Authentication > Providers」でメール確認(Confirm email)が有効な場合、新規登録後に確認メールのリンクを開くまでログインが完了しない点に注意。開発中はSupabaseダッシュボードの設定でメール確認を無効化すると動作確認しやすい。

このリポジトリの開発環境にはDockerが無くローカルでSupabaseスタック全体(Auth込み)を起動できないため、ブラウザでの動作確認は実際のSupabaseプロジェクトに接続して行う。RLSポリシー・マイグレーションのSQLレベルの検証だけは、ローカルにインストール済みのPostgreSQLへ`supabase/migrations/*.sql`を番号順に再生する形で行える(CIの`rls-tests`ジョブも同じ方式、`.github/workflows/ci.yml`参照)。

## 権限とタブの対応

ロールは4種類: `一般`(保護者等)・`運営`・`指導者`・`管理者`。単一のソースは`src/lib/permissions.ts`で、UIのタブ出し分け・ルートガード・Supabase RLSの3箇所が同じロール区分に揃うようにしている。

| タブ・機能 | 一般 | 運営 | 指導者 | 管理者 |
|---|---|---|---|---|
| ホーム・予定・出欠(閲覧・登録) | ○ | ○ | ○ | ○ |
| お知らせ(閲覧・投稿) | ○ | ○ | ○ | ○ |
| チーム日報(閲覧・登録・編集・削除) | ○ | ○ | ○ | ○ |
| コーチ日報 | – | – | ○ | ○ |
| 試合(結果閲覧のみ`/game/results`) | ○ | ○ | ○ | ○ |
| 試合(スタメン登録・得点入力`/game`) | – | – | ○ | ○ |
| カルテ(選手カルテ・チームカルテ・スポーツテスト・検定) | – | – | ○ | ○ |
| 選手一覧(カルテタブ内、自分の子どものみ閲覧可) | 一部 | 一部 | ○ | ○ |
| ライブラリ(資料・動画共有) | ○ | ○ | ○ | ○ |
| ユーザー管理: 招待リンク発行(保護者向け) | – | ○ | ○ | ○ |
| ユーザー管理: 招待リンク発行(指導者向け)・取り消し・メンバー編集/削除 | – | – | – | ○ |
| 設定: 自分のアカウント編集 | ○ | ○ | ○ | ○ |
| 設定: チーム設定(配色・ロゴ・プラン・監査ログ・データエクスポート・チーム退会) | – | – | – | ○ |

画面上には権限名は表示せず、裏側の判定のみでタブ・操作を出し分けている。データのアクセス制御はUI側の出し分けに加えて、Supabase側のRow Level Securityで最終的に担保している(`supabase/migrations/`)。

## プラン

`src/lib/plan.ts`の`PLAN_CONFIG`が唯一のソース。お試し(無料)・中間・フル・フルプラス(Pro AI Plus)はStripe Checkoutからセルフ契約でき、料金は`/pricing`(公開ページ)に掲載している。Max以上は個別見積もり制、`max_partner`/`signature_edition`は非公開の非売品プラン(運営が手動付与)。プラン変更はStripe Webhook(`src/app/api/webhooks/stripe/route.ts`)経由で`teams.plan`に反映する(冪等化・監査ログ記録・失敗時のメール通知込み)。

## デザイン・ブランディング

- 共通の`/login` `/signup` `/invite/[token]`は製品名「CIRCLE LINES」の共通ブランディングのみを表示し、特定チームの名称・配色は出さない(新規チームは必ずこの共通画面から登録する)
- 各チームには`teams.slug`(自動採番のランダム英数字)を使った専用ログインURL `/login/{slug}` があり、そこからアクセスした場合だけ設定>ログイン画面で登録したロゴ・チーム名がログイン画面に表示される
- ログイン後はチーム名(+ロゴ)をヘッダーに表示し、配色・ロゴはチームごとにカスタマイズ可能(`teams.theme_primary` / `theme_accent` / `logo_path` / `name`)
- ホーム画面に追加した際のアイコン(PWAアイコン・favicon・apple-touch-icon)は、`get_default_team_logo_path()` RPCで取得した「最初に作られたチーム」のロゴを使う(`src/lib/brandIcon.tsx`)。これはチームが実質1つだけだった開発初期の名残で、`/signup`からの自己登録が可能になった現在は複数チームが混在する前提に見合っていない(既知の制約、後述)
- スケジュールのカレンダー表示(`CalendarView.tsx`)では、日付の数字の文字色で祝日(赤紫、`--holiday`)・土曜(青)・日曜(赤)を区別する(`@holiday-jp/holiday_jp`使用)

## ディレクトリ構成(抜粋)

```
supabase/migrations/    番号順のマイグレーション(スキーマ・RLS・トリガー・RPC・Storage)
src/
  instrumentation.ts     Sentry初期化(SENTRY_DSN未設定時は何もしない)
  app/
    page.tsx, pricing/                              公開LP・料金ページ(未ログイン時のみ)
    (auth)/login, login/[slug], signup, setup, invite/[token]  認証フロー
    (app)/schedule, notice, report, coach-note,      予定/出欠・お知らせ・日報・コーチ日報・
          players, game, karte, library, users,      選手一覧・試合記録・カルテ・ライブラリ・
          settings, team                             ユーザー管理・設定・チームhub
    api/billing/          Stripe Checkout/Billing Portalの作成
    api/webhooks/stripe/  Stripeサブスクリプションイベントの反映(冪等化・監査ログ・メール通知)
    api/cron/              日次バッチ(出欠リマインド・失敗メール再送、チーム完全削除)
    api/export/[type]/     管理者向けデータエクスポート(CSV)
    api/invite/            招待リンクのメール送信
    api/ai-analysis/       AI分析(Pro AI Plus以上)
    api/push/               Web Push購読・送信
  components/        AppHeader・TabBar・Card・Modal等の共通UI
  lib/
    supabase/client.ts, server.ts   ブラウザ/サーバー用Supabaseクライアント
    permissions.ts                  ロール→タブ・操作の可否(単一のソース)
    plan.ts                         プラン→機能・容量の可否(単一のソース)
    database.types.ts               Supabaseスキーマに対応する型定義(手動メンテナンス)
    stripe.ts, email.ts, auditLog.ts, emailNotify.ts, csv.ts, logger.ts  課金・通知・監査ログ・CSV出力・エラーログの各種ヘルパー
```

## お知らせの公開範囲

- お知らせ(`notices`)には公開範囲(`audience`: 全員/指導者のみ/運営以上/学年指定)を設定できる。指導者・管理者はチーム運営を見渡す立場のため、公開範囲に関わらず常にすべてのお知らせを閲覧できる
- 「学年指定」の場合は`target_grade_min`(○年生以上)も必須で、閲覧できるのは対象学年の選手に紐付いた保護者(`player_guardians`、在籍中の選手のみ対象)
- 誰が投稿できるかは全ロール共通で、公開範囲の指定はあくまで「誰が読めるか」を絞るためのもの

## 選手の学年・OB・OG

- `players.grade` は在籍中は"0"(未就学)〜"6"だが、6年生が年度更新でOB・OGになった後も、年度更新のたびに増え続ける。画面上は`obogCohortLabel()`(`src/lib/format.ts`)で「卒団1年目」のような経過年数表示に変換する
- 「選手」一覧にはOB・OGを表示せず、`/players/obog`の専用画面(卒団年次ごとにセクション分け)で確認する
- 年度更新(`advance_academic_year()` RPC)は全選手の学年を一括で書き換える不可逆性の高い操作のため、管理者のみが実行できる

## 出欠と選手⇔保護者の紐付け

- 出欠(`attendances`)は「ログインアカウント」単位ではなく、`player_guardians`(選手⇔保護者アカウントの多対多)で紐付けられた「選手」単位・「指導者本人」単位で記録する
- 紐付けは管理者が「ユーザー管理」タブの各ユーザー欄から選手を選んで設定する
- 予定には「対象」(全員 / ○年生以上、`schedules.target_grade_min`)を設定でき、対象外の学年の選手は出欠登録・出欠一覧の両方から除外される
- 管理者は選手・未紐付けアカウント双方の出欠を代理登録・修正・削除できる

## 試合記録

- `/game`は試合(`schedules.type='game'`)の一覧をカード表示し、`/game/[id]`で該当試合のスタメン・クォーターごとの出場記録・得点を記録する
- 試合(`game_matches`)には対戦相手・自チーム/相手チームの得点・振り返り用動画URL(YouTube等)を記録できる。勝敗は得点から自動判定する
- `/game/results`(試合結果一覧)は得点入力済みの全試合を日付降順で一覧表示し、勝敗数・勝率を自動集計する。4月始まりの年度(`fiscalYearOf`)またはチーム単位で手動固定した年度(`schedules.fiscal_year_override`)で絞り込める
- 「試合」タブは一般・運営にも表示するが、リンク先は結果閲覧専用の`/game/results`に固定している(`tabHrefForRole`)

## 選手メモのスタンプ機能

- 選手メモ(`/players/[id]/notes`)の各メモに、閲覧した他の指導者・管理者がスタンプ(👍/🙆/🙇)を押せる(`player_note_reactions`)
- スタンプの絵柄は[Twemoji](https://github.com/jdecked/twemoji)のSVG画像を`public/emoji/`に同梱している([CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/))

## 既知の制約・今後の課題

- 複数チーム所属ユーザーへの対応(チーム選択画面`/select-team`)は実装済みだが、限定的な検証に留まっている
- ホーム画面アイコン(PWAアイコン)が「最初に作られたチーム」のロゴ固定になっている(上記デザイン節参照)。`/signup`からの自己登録チームが増えるにつれて優先度が上がる課題
- アクセシビリティ(スクリーンリーダー対応・キーボード操作・コントラスト比の網羅的な監査)は未着手
- 高負荷時の挙動(大量選手登録チーム・大量同時アクセス)の負荷試験は未実施
- このリポジトリの開発環境にはDockerが無くローカルSupabaseスタックを起動できないため、Auth込みのブラウザ動作確認は実際のSupabaseプロジェクトに接続して行う必要がある(RLS/マイグレーションのSQL検証はローカルPostgreSQLで可能、CIの`rls-tests`ジョブが自動化済み)
