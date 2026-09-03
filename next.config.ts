import type { NextConfig } from "next";

// Bottom Navigationの調査中、pushしたコード変更が実機のSafari/PWAで反映されず
// 古いキャッシュが表示され続ける事象が繰り返し発生したため、一時的にno-storeで
// 全ページの再検証を強制していた。ただしno-storeはブラウザキャッシュへの保存自体を
// 禁止するため、ページ遷移のたびに毎回フルレスポンスを取得し直すことになり、
// 体感速度の悪化(もっさり感)につながっていた。
// no-cacheはレスポンスの保存自体は許可しつつ、使用前に必ずサーバーへ再検証(条件付き
// リクエスト)させるため、古いコードがそのまま表示され続ける問題を防ぎつつ、
// 304 Not Modifiedによる高速化の余地を残せる。
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // /_next/static配下はcontent-hash付きの不変アセットなので対象外にし、
        // それ以外(HTMLページ・RSCペイロード等)にだけno-cacheを強制する。
        source: "/((?!_next/static).*)",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
