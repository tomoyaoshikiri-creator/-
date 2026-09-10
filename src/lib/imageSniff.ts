// ファイルの中身(マジックバイト)から実際の画像形式を判定する。拡張子・ブラウザが送る
// Content-Typeはどちらも偽装可能(例: .pngという名前で中身が別形式のファイル)なため
// 信用せず、ここでの判定結果のみを正とする(A-9)。
export type SniffedImageMimeType = "image/png" | "image/jpeg" | "image/webp";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50]; // "WEBP"(RIFFヘッダーの8バイト目から)

function matchesSignature(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

export function detectImageMimeType(bytes: Uint8Array): SniffedImageMimeType | null {
  if (matchesSignature(bytes, PNG_SIGNATURE)) return "image/png";
  if (matchesSignature(bytes, JPEG_SIGNATURE)) return "image/jpeg";
  if (matchesSignature(bytes, RIFF_SIGNATURE) && matchesSignature(bytes, WEBP_SIGNATURE, 8)) {
    return "image/webp";
  }
  return null;
}

export function extensionForImageMimeType(mimeType: SniffedImageMimeType): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
  }
}
