import type { CapacitorConfig } from "@capacitor/cli";

// Web版(Next.js、Vercelでホスト)をそのままWebViewで表示する構成
// (docs/native-app-wrapper-plan.md参照)。ローカルにビルド成果物をバンドルせず、
// 常に本番のWeb版をそのまま表示するため、webDirはCapacitorの仕様上必須だが
// 実際には使われない(server.url指定時は無視される)。
// server.urlは現時点ではVercelの既定ドメイン(sand-nu-63.vercel.app)を指しているが、
// 本番リリース前に独自ドメインへ差し替えること(Universal Links/App Linksの
// 設定にも独自ドメインが必要)。
const config: CapacitorConfig = {
  appId: "jp.faithcreation.circlelines",
  appName: "CIRCLE LINES",
  webDir: "public",
  server: {
    url: "https://sand-nu-63.vercel.app",
    androidScheme: "https",
  },
};

export default config;
