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
// いずれも変化しなかった。この約68pt帯はページ側のCSS/manifestでは制御できない、
// ホーム画面追加(standalone)時のiOS側の予約領域として受け入れる。
// Next.jsのMetadata API(appleWebApp.capable)は標準の"mobile-web-app-capable"
// (apple-プレフィックス無し)しか出力せず、旧来の"apple-mobile-web-app-capable"
// (apple-プレフィックス付き)は出力しない。iOSのホーム画面追加(standalone)は
// 依然としてapple-プレフィックス付きの方を見ており、これが無いと
// viewport-fit=cover / apple-mobile-web-app-status-bar-styleを指定していても
// env(safe-area-inset-*)が正しく機能しない(常に0扱いになる)ケースがある。
// otherフィールドで明示的に追加する。
//
// statusBarStyle / viewport-fit の経緯(2026-10):
// 1. iPad mini Safariでログイン画面の入力欄をタップするとSafariごとクラッシュする
//    不具合が実機で確認された(原因はiPadOS側のバグ。画面キーボードのレイアウト
//    切り替えとAutoFillの判定処理が重なるタイミングで未処理の例外が発生している
//    ことを実機のクラッシュログで確認済み)。
// 2. 疑わしかったCSSのcolor-mix()をアプリ全体から完全に除去した状態でも、
//    statusBarStyleを"black-translucent"に戻すと数分以内にクラッシュが再現する
//    ことを確認した(="default"への変更自体がcrash対策として必要だった)。
// 3. "default"に変更した結果、viewport-fit=cover(本来black-translucentと
//    セットの設定)との食い違いにより.app-shell(position:fixed; inset:0)の
//    高さが実機の画面高さと合わず、画面下部に原因不明の余白ができる不具合が
//    発生したため、一旦viewport-fitも撤去した。
// 4. その後、.app-shellの高さをheight:100dvh(env(safe-area-inset-*)に依存しない
//    動的ビューポート単位)で明示する対応に切り替えた。これによりcover/非cover
//    どちらの組み合わせでも.app-shellの高さが実機と一致するようになったため、
//    フチなしヘッダーのデザインを優先し、viewport-fit=cover +
//    statusBarStyle="black-translucent"に戻した。
//    ⚠️ 上記2.の通り、この組み合わせは過去に実機でクラッシュが再現した設定であり、
//    原因はiPadOS側のバグで完全な回避保証はない。再発した場合は直ちに
//    "default" + viewport-fit撤去に戻すこと(このコメント追加前の版を参照)。
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
