import { describe, expect, it } from "vitest";
import { decodeCsvFile, parseCsv, stripBom, toCsv } from "../csv";

describe("toCsv", () => {
  it("先頭にBOMを付与し、値をカンマ区切りで並べる", () => {
    const csv = toCsv(["姓", "名"], [["山田", "太郎"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("姓,名\r\n山田,太郎\r\n");
  });

  it("カンマ・改行・ダブルクォートを含む値はダブルクォートで囲みエスケープする", () => {
    const csv = toCsv(["備考"], [['a,b"c\nd']]);
    expect(csv).toContain('"a,b""c\nd"');
  });

  it("先頭が=+-@の値はシングルクォートを付けて数式として解釈されないようにする(CSVインジェクション対策)", () => {
    expect(toCsv(["x"], [["=SUM(A1)"]])).toContain("'=SUM(A1)");
    expect(toCsv(["x"], [["+1"]])).toContain("'+1");
    expect(toCsv(["x"], [["-1"]])).toContain("'-1");
    expect(toCsv(["x"], [["@cmd"]])).toContain("'@cmd");
  });
});

describe("parseCsv", () => {
  it("単純なCSVを行・列に分解する", () => {
    expect(parseCsv("姓,名\r\n山田,太郎\r\n")).toEqual([
      ["姓", "名"],
      ["山田", "太郎"],
    ]);
  });

  it("ダブルクォートで囲まれた値の中のカンマ・改行を1つのフィールドとして扱う", () => {
    expect(parseCsv('姓,備考\r\n山田,"a,b\nc"\r\n')).toEqual([
      ["姓", "備考"],
      ["山田", "a,b\nc"],
    ]);
  });

  it('ダブルクォートのエスケープ("")を元の1文字に戻す', () => {
    expect(parseCsv('x\r\n"a""b"\r\n')).toEqual([["x"], ['a"b']]);
  });

  it("末尾に改行が無い最終行も取りこぼさない", () => {
    expect(parseCsv("x,y\r\n1,2")).toEqual([
      ["x", "y"],
      ["1", "2"],
    ]);
  });
});

describe("stripBom", () => {
  it("先頭のUTF-8 BOMだけを取り除く", () => {
    expect(stripBom("﻿abc")).toBe("abc");
    expect(stripBom("abc")).toBe("abc");
  });
});

describe("decodeCsvFile", () => {
  it("正しいUTF-8バイト列はそのままデコードする", () => {
    const buffer = new TextEncoder().encode("山田太郎,あいう").buffer;
    const result = decodeCsvFile(buffer);
    expect(result.text).toBe("山田太郎,あいう");
    expect(result.mojibakeSuspected).toBe(false);
  });

  it("UTF-8として不正なバイト列はShift_JISとして読み直す", () => {
    // "あ"のShift_JIS(CP932)バイト列。0x82は単独ではUTF-8として不正(先頭バイトになり得ない)。
    const buffer = new Uint8Array([0x82, 0xa0]).buffer;
    const result = decodeCsvFile(buffer);
    expect(result.text).toBe("あ");
    expect(result.mojibakeSuspected).toBe(false);
  });
});
