import type { MetadataRoute } from "next";

// theme_color: Brand Blue(#087CF0)を採用。Brand Navy(#123BDB)はステータスバー等では
// ほぼ黒に近く視認しづらいため、CIRCLE LINESブランドグラデーションの中でPWAのUI要素
// (Android/Chromeのアドレスバー・ステータスバー等)に単色で使っても十分な明度・彩度を保ち、
// かつsrc/lib/theme.tsのteamPrimaryフォールバック(未設定チームのデフォルト)とも一致する
// Brand Blueを選択した。
// background_color: ホーム画面追加(standalone)時にiOSがタブバー下部
// (ホームインジケーター領域)に予約している約68ptの帯に、この値が使われている
// 疑いがあるため、現在の--paper(#FAFBFC)に合わせた。実機のピクセル解析で、
// TabBar自体をposition:fixed+portalで画面物理下端まで届くよう変更しても
// 全く同じ位置(68pt手前)で描画が止まることを確認しており、ページ側のCSSでは
// 制御できない領域である可能性が高いための対応。
// display: "standalone"→"fullscreen"に変更(検証用)。上記の68pt帯自体を
// なくせないか試す。fullscreenはOSのシステムUI領域予約を一切要求しない設定の
// ため、ステータスバー(時刻・電波・バッテリー表示)ごと非表示になる副作用の
// リスクがある。問題が出た場合はstandaloneに戻すこと。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CIRCLE LINES",
    short_name: "CIRCLE LINES",
    description: "CIRCLE LINES — チーム運営プラットフォーム",
    start_url: "/",
    display: "fullscreen",
    background_color: "#FAFBFC",
    theme_color: "#087cf0",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
