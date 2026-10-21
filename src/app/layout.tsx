import type { Metadata, Viewport } from "next";
import { Cormorant, Noto_Sans_JP, Roboto_Mono } from "next/font/google";
import { TapFeedback } from "@/components/TapFeedback";
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

// タブバーがホームインジケーター手前(約68pt)で止まる問題について、padding拡張・
// position:fixed・document.bodyへのportal・manifest.display変更・
// viewport-fit=cover撤去(status barを不透明に戻す)の5方式を実機のピクセル解析
// (マゼンタ等の判別可能な色での検証を含む)で確認したが、タブバーの位置は
// いずれも変化しなかった。viewport-fit=cover撤去はステータスバー周りの見た目を
// 悪化させる代償だけを生む結果だったため、フチなしヘッダー(黒背景に
// グラデーションが裏まで伸びるデザイン)を維持する判断とした。この約68pt帯は
// ページ側のCSS/manifestでは制御できない、ホーム画面追加(standalone)時の
// iOS側の予約領域として受け入れる。
// Next.jsのMetadata API(appleWebApp.capable)は標準の"mobile-web-app-capable"
// (apple-プレフィックス無し)しか出力せず、旧来の"apple-mobile-web-app-capable"
// (apple-プレフィックス付き)は出力しない。iOSのホーム画面追加(standalone)は
// 依然としてapple-プレフィックス付きの方を見ており、これが無いと
// viewport-fit=cover / apple-mobile-web-app-status-bar-styleを指定していても
// env(safe-area-inset-*)が正しく機能しない(常に0扱いになる)ケースがある。
// otherフィールドで明示的に追加する。
// statusBarStyle: 一時的に"default"(ステータスバー領域を不透明の帯として
// OS側に確保させる)へ変更していたが、iPad mini Safariでのログインクラッシュの
// 真因は別(color-mix()、globals.css/theme.tsの修正を参照)と判明した。
// "default"のまま残すと、"cover"のままのviewport-fit(下記viewport)と設定が
// 噛み合わず、ステータスバーの不透明領域とwebviewの描画領域の計算がズレて、
// 画面全体が上にズレる・下端が切れる不具合が新たに発生したため、
// "black-translucent"(コンテンツがステータスバー裏まで伸びる・フチなし
// ヘッダー)に戻した。
export const metadata: Metadata = {
  title: "CIRCLE LINES",
  description: "CIRCLE LINES — チーム運営プラットフォーム",
  applicationName: "CIRCLE LINES",
  appleWebApp: {
    capable: true,
    title: "CIRCLE LINES",
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${cormorant.variable} ${notoSansJP.variable} ${robotoMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <TapFeedback />
        {children}
      </body>
    </html>
  );
}
