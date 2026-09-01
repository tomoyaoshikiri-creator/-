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

// viewport-fit=coverを外すとBottom Navigationは改修前と一致するが、代わりに
// ステータスバー領域に黒い帯が再発することを実機比較で確認した。coverは維持し、
// 代わりに.app-shellの下端(globals.css)とbodyの背景色を工夫することで、
// 黒帯を出さずにBottom Navigation側も改修前に近づける方針にする。
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
      <body className="min-h-full">{children}</body>
    </html>
  );
}
