// アップロード前にブラウザ側で画像を縮小・再圧縮し、ストレージ使用量を抑える。
// スマホ写真(数MB)をアプリ内表示(最大480px幅)に十分な長辺1600px・JPEG品質80%まで落とす。
// GIF(アニメーション)・SVG(ベクター)は対象外。HEICなど非対応形式やエラー時は元のファイルをそのまま返す。
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;
const SKIP_TYPES = new Set(["image/gif", "image/svg+xml"]);

export async function resizeImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || SKIP_TYPES.has(file.type)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    // 透過PNGをJPEGにすると黒背景になることがあるため、先に白で塗りつぶしておく。
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[a-zA-Z0-9]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
