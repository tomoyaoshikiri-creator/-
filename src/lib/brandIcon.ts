import { readFileSync } from "node:fs";
import path from "node:path";

// CIRCLE LINES公式アプリアイコン(正本: src/assets/brand/circle-lines-icon-master.jpg)を
// 用途別サイズへ変換した静的PNGを配信する。favicon(/icon, /apple-icon)はNext.jsの
// Metadata API規約(icon.tsx/apple-icon.tsx)経由、/icons/192・/icons/512はmanifest.tsが
// 参照する独自パスのためRoute Handler経由で、いずれもこのファイルの関数を呼ぶ。
// 中身はDB/チームには一切依存しない固定アセット。
//
// Phase UI-2A以前は、このファイルが get_default_team_logo_path() RPC経由で
// 「DB内で最初に作成されたチームのロゴ」を取得し、サービス全体のfavicon/PWAアイコンに
// 流用していた(1チーム専用運用だった名残)。CIRCLE LINESはマルチチームサービスのため、
// サービスブランドとチームブランドを分離し、ここは常に固定のCIRCLE LINESブランドアイコンを返す。
//
// 補足(icon.tsx/apple-icon.tsxを静的なicon.png/apple-icon.pngに置き換えなかった理由):
// Next.jsは静的な拡張子付きファイル(app/icon.png等)を置くと、実際に配信されるURLが
// 拡張子込みの/icon.pngになり、既存の/icon(拡張子なし)というURLと一致しなくなることを
// ビルド確認で確認した。既存URLを維持する必要があるため、Metadata APIの生成関数
// (icon.tsx/apple-icon.tsx)経由でこの固定アセットを返す方式を維持している。
//
// readFileSyncの引数は、サイズごとにprocess.cwd()起点の静的な文字列リテラルを直接渡す
// (Record経由の動的キー参照だと、Next.jsのビルド時ファイルトレースが静的解析できず
// 「プロジェクト全体をサーバーコードに含めてしまう」警告が出るため、呼び出し箇所ごとに
// リテラルを直書きする形に分けている)。

// モジュール読み込み時に一度だけファイルを読み、リクエストごとのディスクI/Oを避ける。
const icon32Buffer = readFileSync(path.join(process.cwd(), "src/assets/brand/circle-lines-icon-32.png"));
const icon180Buffer = readFileSync(path.join(process.cwd(), "src/assets/brand/circle-lines-icon-180.png"));
const icon192Buffer = readFileSync(path.join(process.cwd(), "src/assets/brand/circle-lines-icon-192.png"));
const icon512Buffer = readFileSync(path.join(process.cwd(), "src/assets/brand/circle-lines-icon-512.png"));

export async function renderCircleLinesIcon(size: 32 | 180 | 192 | 512): Promise<Response> {
  const buffer =
    size === 32 ? icon32Buffer : size === 180 ? icon180Buffer : size === 192 ? icon192Buffer : icon512Buffer;
  return new Response(new Uint8Array(buffer), {
    headers: { "content-type": "image/png", "cache-control": "no-store" },
  });
}
