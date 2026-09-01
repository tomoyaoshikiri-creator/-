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

export const metadata: Metadata = {
  title: "CIRCLE LINES",
  description: "CIRCLE LINES — チーム運営プラットフォーム",
  applicationName: "CIRCLE LINES",
  appleWebApp: {
    capable: true,
    title: "CIRCLE LINES",
    statusBarStyle: "black-translucent",
  },
};

// 【一時的な比較検証用】Bottom Navigationの余白問題の原因がviewport-fit=cover自体に
// あるかどうかを実機で直接見比べるため、viewportFit: "cover"を一時的に外している。
// これを外すとPhase UI-2B以前のように、ステータスバー領域にOSの黒い帯が表示される
// 不具合が再発する可能性がある(その代わりBottom Navigation側は改修前と一致するはず)。
// 比較確認後、どちらを採用するか判断してcoverを戻すか確定するかを決める。
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
