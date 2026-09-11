# 運用手順書(Runbook)

CIRCLE LINESの本番運用に関するリファレンス。導入手順自体は[README.md](../README.md)を参照し、ここではデプロイ後の日常運用・障害対応に必要な情報をまとめる。

## デプロイフロー

- ホスティングはVercel。`main`ブランチへのマージで本番デプロイが走る(Vercel GitHub連携)
- 開発は1機能=1PR、`main`から切ったブランチで作業し、CI(`.github/workflows/ci.yml`)がPRごとに走る
  - `build-and-test`: `next typegen` → `tsc --noEmit` → `lint` → `test`(Vitest) → `build`
  - `rls-tests`: ローカルSupabaseスタック(`supabase start`)上に全マイグレーションを番号順に再生し、`supabase test db`でpgTAPテスト(`supabase/tests/database/`)を実行してRLSの越境防止を検証する
- マイグレーション(`supabase/migrations/*.sql`)を含むPRは、CIで疎通を確認したうえで、本番Supabaseプロジェクトへの適用は都度人間の承認を得てから実施する(このリポジトリではSupabase管理コンソールのSQL Editor、またはSupabase MCPツールの`apply_migration`を使用)。適用後は`get_advisors`(security)で新規に問題が出ていないかを確認する
- マイグレーションのSQLは基本的に不可逆な変更(カラム追加・データ移行等)を含むため、各マイグレーションファイル自体にロールバック方針をコメントで残す運用にしている(取り消しが必要な場合は個別に判断)

## 環境変数一覧

`.env.local.example`にも同内容のコメント付きテンプレートがある。Vercel側は Project Settings > Environment Variables に同名で設定する。

| 変数 | 必須 | 用途・未設定時の挙動 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 必須 | Supabaseクライアント(ブラウザ・サーバー共通)の接続情報 |
| `SUPABASE_SERVICE_ROLE_KEY` | 実質必須 | RLSを経由しないサーバー専用処理(チーム退会・課金・監査ログ書き込み・日次バッチ・データエクスポートの監査記録)で使用。ブラウザに露出させない |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | 任意 | Web Push通知の鍵ペア(`npx web-push generate-vapid-keys`で生成)。未設定ならプッシュ送信のみスキップ |
| `CRON_SECRET` | 強く推奨 | 日次バッチ(`/api/cron/*`)をVercel以外から叩けないようにする認証。未設定だとバッチ自体は動くが誰でも叩けてしまう |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | 有料プラン運用時は必須 | Stripe Checkout/Billing Portalの作成とWebhook署名検証 |
| `STRIPE_PRICE_ID_MIDDLE` / `_FULL` / `_PRO_PLUS`(各`_YEARLY`版含む) | 有料プラン運用時は必須 | 中間・フル・フルプラスの月額/年額Price ID |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | 現状未使用 | クライアント側Stripe.jsは使っていない(Checkoutは全てサーバーが作成したURLへのリダイレクト)ため予約枠 |
| `ANTHROPIC_API_KEY` | AI分析機能利用時は必須 | Pro AI Plus以上のAI分析(選手・チームの成績コメント生成)。未設定だとボタン押下時にエラー |
| `SENTRY_DSN` | 推奨 | サーバーエラー監視(`@sentry/node`、Node.js専用・ブラウザ側エラーは送信しない)。未設定でも`console.error`には出る |
| `RESEND_API_KEY` / `RESEND_FROM_ADDRESS` | 推奨 | 重要通知(招待・出欠締切・請求失敗・チーム退会予告)のメールフォールバック。未設定だと送信のみスキップ(`email_notifications`に記録も残らない) |
| `SITE_URL` | 推奨 | 通知メール本文中のリンクの起点URL。未設定だとリンクが省略される |

## Vercel Cronジョブ

`vercel.json`で2つ定義している。いずれも`Authorization: Bearer <CRON_SECRET>`をVercelが自動付与する。

- `/api/cron/attendance-reminders`(毎日23:00 UTC): 出欠未登録者へのリマインド送信(プッシュ優先、購読が無いユーザーへはメールにフォールバック) → 失敗していたメール通知の再送(最大3回まで) → Sentry Cron Monitor(`attendance-reminders`)にチェックイン
- `/api/cron/team-deletion`(毎日23:30 UTC): 退会申請から7日経過したチームの完全削除 → Sentry Cron Monitor(`team-deletion`)にチェックイン

新しい日次バッチを追加する際は、Cronジョブを増やすのではなくこの2つのいずれかに相乗りさせる方針(Vercelの無料枠のCron本数制約と、監視対象を増やしすぎない意図)。

## 監視・インシデント対応

- **エラー監視**: Sentry(SENTRY_DSN設定時)。サーバーサイドのみ計装しており、ブラウザ側の実行時エラーは送られない。Cron Monitorで日次バッチの未実行・異常終了も検知できる
- **セキュリティ点検**: 新しいSECURITY DEFINER関数やRLSポリシーを追加した後は、Supabase MCPの`get_advisors(type: "security")`(またはダッシュボードのAdvisors)を必ず確認する。特に「`anon`/`authenticated`に対する関数の意図しないEXECUTE権限」は、`alter default privileges`がスキーマ単位で自動的に`anon`/`authenticated`/`service_role`へEXECUTEを付与する設定になっているため、`revoke ... from public`だけでは不十分で、`revoke ... from authenticated, anon`を明示的に書く必要がある(発生済みの実例: `supabase/migrations/0142`〜`0144`)
- **監査ログ**: 管理者は「設定 > 監査ログ」(`/settings/audit-log`)から、ロール変更・招待発行/取消・メンバー削除・チーム退会申請・AI分析生成・課金変更・データエクスポートの記録を確認できる(`audit_logs`テーブル、`src/lib/auditLog.ts`)
- **決済まわりの異常**: Stripe Webhook(`/api/webhooks/stripe`)は`stripe_webhook_events`テーブルで受信イベントを冪等化・記録している。処理に失敗すると5xxを返しStripe側が自動再送する設計のため、Stripeダッシュボードの Webhook > Recent deliveries で失敗が続いていないかを確認する
- **メール送達の異常**: `email_notifications`テーブルの`status='failed'`かつ`attempt_count`が3に達した行は自動再送されなくなる。Resendダッシュボードでドメイン認証・送信制限に問題がないか確認したうえで、必要なら該当行を調査する

## ローカルでのRLS/マイグレーション検証

Docker無しの環境でも、ローカルにインストール済みのPostgreSQLへ`supabase/migrations/*.sql`を番号順に再生することでSQLレベルの検証ができる(CIの`rls-tests`ジョブと同じ方式)。手順の要点:

1. ローカルPostgreSQLを起動し、検証用の使い捨てDBを作成する
2. `auth`/`storage`スキーマの最小限のスタブ(`auth.uid()`/`auth.jwt()`/`storage.foldername()`等の関数、`anon`/`authenticated`/`service_role`ロール)を用意する
3. `supabase/migrations/*.sql`を番号順に`psql -v ON_ERROR_STOP=1 -f`で適用する。ただし本番の実データ前提の2箇所(`0104`実行前に`teams`へ「都賀ビクトリーズ」を1件seedする、`0113`はフレッシュ再生時はスキップする)は`.github/workflows/ci.yml`の該当ステップを参照
4. 検証後は使い捨てDBを削除する

新しいRLSポリシーやSECURITY DEFINER関数を追加した際は、`role`を`authenticated`に切り替えて`has_function_privilege()`等で実際に権限が意図通りかを確認してからPRを出すこと(「書いたはずのポリシーが効いていなかった」を機械的に防ぐため)。
