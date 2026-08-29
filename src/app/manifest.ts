import type { MetadataRoute } from "next";

// theme_color: Brand Blue(#087CF0)を採用。Brand Navy(#123BDB)はステータスバー等では
// ほぼ黒に近く視認しづらいため、CIRCLE LINESブランドグラデーションの中でPWAのUI要素
// (Android/Chromeのアドレスバー・ステータスバー等)に単色で使っても十分な明度・彩度を保ち、
// かつsrc/lib/theme.tsのteamPrimaryフォールバック(未設定チームのデフォルト)とも一致する
// Brand Blueを選択した。
// background_color: 旧来の--paper(#faf8f3、FAITH CREATION由来の温かみのあるクリーム色)ではなく、
// Phase UI-1で追加したsemantic token --surface(#ffffff)と揃えた、ブランド非依存のニュートラルな白。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CIRCLE LINES",
    short_name: "CIRCLE LINES",
    description: "CIRCLE LINES — チーム運営プラットフォーム",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#087cf0",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
