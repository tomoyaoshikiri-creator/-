import type { Metadata, Viewport } from "next";
import { Cormorant, Noto_Sans_JP, Roboto_Mono } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant({
  variable: "--font-display-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["500", "700"],
});

// 【実験】タブバーがホームインジケーター手前(約68pt)で止まる問題について、
// padding拡張・position:fixed・document.bodyへのportal・manifest.display変更の
// 4方式を実機のピクセル解析(マゼンタ等の判別可能な色での検証を含む)で確認したが、
// いずれも全く同じ位置で描画が止まった。viewport-fit=cover(Headerがステータスバー
// 裏までグラデーションで伸びる、フチなしデザイン)とstatusBarStyle:
// black-translucentの組み合わせが、iOS側でこの約68pt帯を予約させている本命の
// 原因という仮説のもと、この2つをやめてOS標準のステータスバー表示に戻す。
// Next.jsのMetadata API(appleWebApp.capable)は標準の"mobile-web-app-capable"
// (apple-プレフィックス無し)しか出力せず、旧来の"apple-mobile-web-app-capable"
// (apple-プレフィックス付き)は出力しない。iOSのホーム画面追加(standalone)は
// 依然としてapple-プレフィックス付きの方を見ているため、otherフィールドで
// 明示的に追加している(こちらは実験対象ではなく維持)。
export const metadata: Metadata = {
  title: "CIRCLE LINES",
  description: "CIRCLE LINES — チーム運営プラットフォーム",
  applicationName: "CIRCLE LINES",
  appleWebApp: {
    capable: true,
    title: "CIRCLE LINES",
    statusBarStyle: "default",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${cormorant.variable} ${notoSansJP.variable} ${robotoMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
