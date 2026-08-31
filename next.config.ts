import type { NextConfig } from "next";

// Bottom Navigationの調査中、pushしたコード変更が実機のSafari/PWAで反映されず
// 古いキャッシュが表示され続ける事象が繰り返し発生した。原因の切り分けとして、
// 全ページのHTMLレスポンスに明示的なno-cacheヘッダーを付け、ブラウザ側の
// キャッシュに起因する古い表示を確実に排除する。
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // /_next/static配下はcontent-hash付きの不変アセットなので対象外にし、
        // それ以外(HTMLページ・RSCペイロード等)にだけno-cacheを強制する。
        source: "/((?!_next/static).*)",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
