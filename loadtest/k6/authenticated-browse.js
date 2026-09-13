// ログイン後の主要な閲覧画面(一覧系)への負荷試験。すべてGETのみで、書き込みは
// 一切行わない(データを増やさない・壊さない)。
//
// 使い方:
//   k6 run loadtest/k6/authenticated-browse.js \
//     -e BASE_URL=http://localhost:3000 \
//     -e LOAD_TEST_EMAIL=loadtest@example.com \
//     -e LOAD_TEST_PASSWORD=xxxxxxxx
//
// 必ず負荷試験専用に用意したテストチーム・テストアカウントを使うこと
// (本番ユーザーの認証情報を絶対に使わない)。
//
// ⚠️ BASE_URLに本番ドメインを指定して実行する前に、必ず人間の承認を得ること
// (アクセス集中でVercel/Supabaseの利用量・料金に影響しうるため)。デフォルトは
// ローカル開発サーバーを指しており、明示的にBASE_URLを渡さない限り他環境には
// アクセスしない。
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const EMAIL = __ENV.LOAD_TEST_EMAIL;
const PASSWORD = __ENV.LOAD_TEST_PASSWORD;

// docs/load-handling-todo.md記載の「.limit()なしで全件取得している一覧画面」を中心に、
// ホーム(新着集計)も含めた読み取り主体の画面。
const READ_PATHS = [
  "/home",
  "/notice",
  "/report",
  "/coach-note",
  "/players",
  "/schedule",
  "/schedule/history",
  "/game/results",
  "/library",
  "/karte/team",
];

export const options = {
  scenarios: {
    ramping_authenticated_browse: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: Number(__ENV.TARGET_VUS || 10) },
        { duration: "1m", target: Number(__ENV.TARGET_VUS || 10) },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1500"],
  },
};

// setup()はテスト全体で1回だけ実行される。ここで実際のログインフォーム(JS無効時の
// プログレッシブエンハンスメント経由のHTML <form> POST)を通じてログインし、発行された
// セッションCookieを各VUに引き継ぐ。Next.js Server Actionの内部実装(hidden fieldの
// 命名規則等、ビルドごとに変わりうる詳細)に依存しないよう、ログインページが実際に
// レンダリングしたhidden inputをすべてそのまま転送する方式にしている
// (email/passwordだけ人間側で差し込む)。
export function setup() {
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      "LOAD_TEST_EMAIL / LOAD_TEST_PASSWORD を環境変数で指定してください" +
        "(負荷試験専用に用意したテストアカウントを使うこと。本番ユーザーの認証情報は使わないこと)。",
    );
  }

  const loginPage = http.get(`${BASE_URL}/login`);
  check(loginPage, { "login page loaded": (r) => r.status === 200 });

  const doc = loginPage.html();
  const body = { email: EMAIL, password: PASSWORD };
  doc.find('form input[type="hidden"]').each((_, el) => {
    const name = el.attr("name");
    if (name) body[name] = el.attr("value") || "";
  });

  const res = http.post(`${BASE_URL}/login`, body, { redirects: 0 });
  check(res, {
    // ログイン成功時はServer Action内のredirect()によりリダイレクト応答になる想定
    // (JS無効時のフォールバックのため通常のHTTPナビゲーションと同じ3xxになるはず)。
    // ここが失敗する場合、フォームのhidden field構成が変わっていないか確認すること。
    "login response looks like a redirect": (r) => r.status >= 300 && r.status < 400,
  });

  const cookies = {};
  for (const [name, arr] of Object.entries(res.cookies)) {
    if (arr.length > 0) cookies[name] = arr[0].value;
  }
  if (Object.keys(cookies).length === 0) {
    throw new Error("ログインに失敗した可能性があります(セッションCookieが取得できませんでした)。");
  }
  return { cookies };
}

export default function browseAuthenticatedPages(data) {
  const jar = http.cookieJar();
  for (const [name, value] of Object.entries(data.cookies)) {
    jar.set(BASE_URL, name, value);
  }

  const path = READ_PATHS[Math.floor(Math.random() * READ_PATHS.length)];
  const res = http.get(`${BASE_URL}${path}`);
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(Math.random() * 2 + 1);
}
