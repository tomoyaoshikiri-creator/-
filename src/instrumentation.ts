// サーバーインスタンス起動時に一度だけ呼ばれる(Next.jsのinstrumentation規約)。
// SENTRY_DSN未設定の環境(このリポジトリのデフォルト状態)では何もしない
// (Web Push/Stripeの鍵未設定時と同じ、機能を静かに無効化する方針)。
//
// @sentry/nextjsのbuildラッパー(withSentryConfig、自動計装)は使わず、@sentry/nodeの
// 手動初期化のみを使う。このリポジトリはNext.js独自版(AGENTS.md参照)のため、
// ビルドプロセスに介入する自動計装は標準外の挙動と衝突するリスクがあり避けた。
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.SENTRY_DSN) return;

  const Sentry = await import("@sentry/node");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
}
