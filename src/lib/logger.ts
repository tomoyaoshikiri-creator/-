import * as Sentry from "@sentry/node";

// console.error脱却の第一歩(B-1)。既存のconsole.error呼び出しをこれに置き換える。
// SENTRY_DSN未設定の環境(このリポジトリのデフォルト状態)ではconsole.errorのみを行い、
// Sentry側の呼び出しは行わない(instrumentation.tsでSentry.init自体もスキップされている)。
//
// サーバー側(Route Handler・cronジョブ)専用。@sentry/nodeはNode.js runtime前提のため、
// クライアントコンポーネントからは呼ばない。
export function logError(message: string, error?: unknown, extra?: Record<string, unknown>): void {
  if (extra !== undefined) {
    console.error(message, error, extra);
  } else if (error !== undefined) {
    console.error(message, error);
  } else {
    console.error(message);
  }

  if (!process.env.SENTRY_DSN) return;
  Sentry.captureException(error instanceof Error ? error : new Error(message), { extra });
}

// cronルートの「実行されたこと」自体をSentry Cron Monitorsに知らせる(B-1)。
// コード側からは検知できない「Vercel Cronが叩かなかった」ケースを拾うのが目的。
// monitorConfigを毎回のcheck-inに含めることで、Sentry側のダッシュボードで
// モニターを事前作成する必要はない(初回のcheck-inで自動作成される)。
export async function withCronCheckIn<T>(
  monitorSlug: string,
  cronSchedule: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!process.env.SENTRY_DSN) return fn();

  const monitorConfig = { schedule: { type: "crontab" as const, value: cronSchedule }, timezone: "Etc/UTC" };
  const checkInId = Sentry.captureCheckIn({ monitorSlug, status: "in_progress" }, monitorConfig);
  try {
    const result = await fn();
    Sentry.captureCheckIn({ checkInId, monitorSlug, status: "ok" }, monitorConfig);
    return result;
  } catch (err) {
    Sentry.captureCheckIn({ checkInId, monitorSlug, status: "error" }, monitorConfig);
    throw err;
  }
}
