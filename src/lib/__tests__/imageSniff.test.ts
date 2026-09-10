import { describe, expect, it } from "vitest";
import { detectImageMimeType, extensionForImageMimeType } from "../imageSniff";

// IMGSNIFF-01: アップロードのサーバー側検証(A-9)の要。拡張子偽装を弾く根拠となる
// マジックバイト判定なので、3形式それぞれの正常系・偽装(拡張子だけ画像っぽいが中身が
// 別物)の両方をテストする。
describe("detectImageMimeType", () => {
  it("PNGシグネチャを認識する", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(detectImageMimeType(bytes)).toBe("image/png");
  });

  it("JPEGシグネチャを認識する", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(detectImageMimeType(bytes)).toBe("image/jpeg");
  });

  it("WebPシグネチャ(RIFF...WEBP)を認識する", () => {
    // RIFF + 4バイトのサイズ(値は判定に無関係) + WEBP
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    expect(detectImageMimeType(bytes)).toBe("image/webp");
  });

  it("RIFFだが8バイト目がWEBPでない(例: 別のRIFF系フォーマット)場合はnull", () => {
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20]);
    expect(detectImageMimeType(bytes)).toBeNull();
  });

  it("SVG(テキストベースのXML)はnull(拒否対象)", () => {
    const bytes = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    expect(detectImageMimeType(bytes)).toBeNull();
  });

  it("拡張子を.pngに偽装したテキストファイルもnull", () => {
    const bytes = new TextEncoder().encode("<script>alert(1)</script>");
    expect(detectImageMimeType(bytes)).toBeNull();
  });

  it("空・極端に短いバイト列はnull", () => {
    expect(detectImageMimeType(new Uint8Array([]))).toBeNull();
    expect(detectImageMimeType(new Uint8Array([0x89, 0x50]))).toBeNull();
  });
});

describe("extensionForImageMimeType", () => {
  it("各MIMEタイプに対応する拡張子を返す", () => {
    expect(extensionForImageMimeType("image/png")).toBe("png");
    expect(extensionForImageMimeType("image/jpeg")).toBe("jpg");
    expect(extensionForImageMimeType("image/webp")).toBe("webp");
  });
});
