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

// 【比較検証用】viewport-fit=coverを維持したままBottom Navigationの余白を
// 減らす方法を4パターン試したが、いずれも「余白が多すぎる」との評価だった。
// 黒帯の原因はviewport-fit=cover自体ではなく、statusBarStyle: "black-translucent"
// (コンテンツがステータスバーの裏まで伸びていることを前提にした透過設定)を
// coverなしで使っていたことによる可能性があるため、coverを外したまま
// statusBarStyleを"default"(不透明な通常のステータスバー)に変更して試す。
export const metadata: Metadata = {
  title: "CIRCLE LINES",
  description: "CIRCLE LINES — チーム運営プラットフォーム",
  applicationName: "CIRCLE LINES",
  appleWebApp: {
    capable: true,
    title: "CIRCLE LINES",
    statusBarStyle: "default",
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
