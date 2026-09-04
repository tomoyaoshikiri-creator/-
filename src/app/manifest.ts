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
// display: 一時的にfullscreenで検証したが、この68pt帯の位置には一切変化がなく
// (ピクセル単位で同一)、ステータスバー非表示のリスクだけが残る結果になったため
// standaloneに戻した。この帯自体は本アプリのコード側では解消できない、
// ホーム画面追加(standalone/fullscreenいずれも)時のiOS側の予約領域と判断し、
// 上記background_colorによる色の統一のみで対応することとした。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CIRCLE LINES",
    short_name: "CIRCLE LINES",
    description: "CIRCLE LINES — チーム運営プラットフォーム",
    start_url: "/",
    display: "standalone",
    background_color: "#FAFBFC",
    theme_color: "#087cf0",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
