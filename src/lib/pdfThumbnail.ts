// PDFの1ページ目を画像化し、お知らせ添付欄などでのサムネイル表示に使う。
// pdf.js(pdfjs-dist)のWorkerスクリプトは/public/pdf.worker.min.mjsとして静的配信して
// いる(node_modules/pdfjs-dist/build/pdf.worker.min.mjsをそのままコピーしたもの)。
// pdfjs-distをアップグレードする際は、このファイルも同じバージョンで上書きコピーし
// 直すこと(バージョンが食い違うとWorker起動時にエラーになる)。
const MAX_EDGE = 480;
const JPEG_QUALITY = 0.8;

// サムネイル化に失敗しても添付自体のアップロードは止めたくないため、例外は投げず
// nullを返す(呼び出し側はthumbnail_pathを設定せず、表示側は汎用アイコンにフォールバックする)。
export async function generatePdfThumbnail(file: File): Promise<File | null> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const page = await pdf.getPage(1);

    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(1, MAX_EDGE / Math.max(baseViewport.width, baseViewport.height));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      await pdf.destroy();
      return null;
    }

    await page.render({ canvasContext: ctx, viewport }).promise;
    await pdf.destroy();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) return null;

    const newName = file.name.replace(/\.[a-zA-Z0-9]+$/, "") + "-thumb.jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    return null;
  }
}
