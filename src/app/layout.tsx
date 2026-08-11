import type { Metadata } from "next";
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
  title: "ClubLink",
  description: "ClubLink — チーム運営アプリ",
  appleWebApp: {
    capable: true,
    title: "TsugaVic",
    statusBarStyle: "black-translucent",
  },
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
