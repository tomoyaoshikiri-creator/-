import type { Metadata, Viewport } from "next";
import { Cormorant, Noto_Sans_JP, JetBrains_Mono } from "next/font/google";
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

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "ClubLink",
  description: "ClubLink — チーム運営アプリ",
  appleWebApp: {
    capable: true,
    title: "TsugaVic",
    statusBarStyle: "black-translucent",
  },
};

// viewport-fit=coverを指定しないと、ホームインジケーター等の安全域を
// env(safe-area-inset-*)で参照しても常に0になってしまう(下部タブバーで使用)。
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${cormorant.variable} ${notoSansJP.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
