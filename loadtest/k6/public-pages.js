// 未ログイン(公開)ページへの負荷試験。認証不要なため、いきなり本番/プレビューに
// 向けて実行しても他人のデータを操作する心配はない(すべてGETのみ)。
//
// 使い方:
//   k6 run loadtest/k6/public-pages.js -e BASE_URL=http://localhost:3000
//
// ⚠️ BASE_URLに本番ドメインを指定して実行する前に、必ず人間の承認を得ること
// (アクセス集中でVercel/Supabaseの利用量・料金に影響しうるため)。デフォルトは
// ローカル開発サーバーを指しており、明示的にBASE_URLを渡さない限り他環境には
// アクセスしない。
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const PATHS = ["/", "/pricing", "/login", "/signup", "/terms", "/privacy", "/tokushoho", "/contact"];

export const options = {
  scenarios: {
    ramping_public_traffic: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: Number(__ENV.TARGET_VUS || 20) },
        { duration: "1m", target: Number(__ENV.TARGET_VUS || 20) },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

export default function browsePublicPages() {
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  const res = http.get(`${BASE_URL}${path}`);
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(Math.random() * 2 + 1);
}
