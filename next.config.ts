import type { NextConfig } from "next";

// CSPのimg-src/connect-srcはSupabase(REST/Auth/Storage)への通信・画像表示を
// 許可する必要があるため、NEXT_PUBLIC_SUPABASE_URLのoriginを動的に組み込む。
// クライアント側でStripe.js・Google Analytics等の外部スクリプトやSentryブラウザSDKは
// 使っておらず(Stripeはサーバー専用、Sentryは@sentry/nodeでNode専用)、フォントも
// next/font/googleでビルド時に自己ホストしているため、script-src/font-srcに
// 外部ドメインを足す必要はない。nonce方式(全ページ動的レンダリング化が必要)は
// このアプリの構成(/pricing等の静的ページを含む)には見合わないため採用せず、
// Next公式docsの「Without Nonces」パターンに沿った固定CSPにする(B-7)。
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

// 開発モードのReactはデバッグ機能(サーバー側エラーのスタック再構築等)でeval()を
// 使うため、Next公式docsの案内通りdev限定でunsafe-evalを許可する
// (本番ビルドではReact/Next.jsともにeval()を使わない)。
const isDev = process.env.NODE_ENV === "development";

// Cloudflare Turnstile(CAPTCHA、C-2)はNEXT_PUBLIC_TURNSTILE_SITE_KEY未設定なら
// ウィジェット自体を描画しないため、CSPも鍵が設定されている時だけ許可ドメインを足す
// (未設定時はB-7時点の最小構成のまま)。
const turnstileEnabled = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${turnstileEnabled ? " https://challenges.cloudflare.com" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:${supabaseOrigin ? ` ${supabaseOrigin}` : ""};
  font-src 'self';
  connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""};
  frame-src 'self'${turnstileEnabled ? " https://challenges.cloudflare.com" : ""};
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Bottom Navigationの調査中、pushしたコード変更が実機のSafari/PWAで反映されず
  // 古いキャッシュが表示され続ける事象が繰り返し発生したため、一時的にno-storeで
  // 全ページの再検証を強制していた。ただしno-storeはブラウザキャッシュへの保存自体を
  // 禁止するため、ページ遷移のたびに毎回フルレスポンスを取得し直すことになり、
  // 体感速度の悪化(もっさり感)につながっていた。
  // no-cacheはレスポンスの保存自体は許可しつつ、使用前に必ずサーバーへ再検証(条件付き
  // リクエスト)させるため、古いコードがそのまま表示され続ける問題を防ぎつつ、
  // 304 Not Modifiedによる高速化の余地を残せる。
  async headers() {
    return [
      {
        // /_next/static配下はcontent-hash付きの不変アセットなので対象外にし、
        // それ以外(HTMLページ・RSCペイロード等)にだけno-cacheを強制する。
        source: "/((?!_next/static).*)",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
      {
        // セキュリティヘッダーは静的アセットを含む全レスポンスに付与する(B-7)。
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
