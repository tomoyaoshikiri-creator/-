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
// statusBarStyle: "default"(ステータスバー領域を不透明の帯としてOS側に確保
// させる)。以前は"black-translucent"だったが、iPad mini Safariでログイン
// 画面を開く・入力欄をタップするとSafariごとクラッシュする不具合が実機で
// 確認され(原因はiPadOS側の不具合。画面キーボードのレイアウト切り替えと
// AutoFillの判定処理が重なるタイミングで未処理の例外が発生していることを
// 実機のクラッシュログで確認済み)、"default"に変更したところ再現しなくなった。
// 上のコメント(24-32行目)にある通り、viewport-fit=coverは本来
// black-translucent(コンテンツがステータスバー裏まで伸びる設計)とセットで
// 使う設定で、"default"(OS側が不透明のステータスバー領域を別途確保する設計)
// とは本来矛盾する組み合わせ。実際にこの食い違いにより、.app-shell
// (position:fixed; inset:0)の高さが実機の画面高さと合わず、画面下部に
// 原因不明の余白ができる不具合が発生したため、"default"化にあわせて
// viewport-fitも撤去した(cover指定なし=iOS標準のauto)。
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
      <body className="min-h-full">
        <TapFeedback />
        {children}
      </body>
    </html>
  );
}
