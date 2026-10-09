function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "string" ? value : JSON.stringify(value);
  // CSVインジェクション対策: 先頭が=+-@だとExcel/スプレッドシートが数式として
  // 解釈してしまうため、先頭に半角シングルクォートを付けて文字列強制する
  // (スプレッドシート側でこの記法を「数式ではなくテキスト」として扱う標準的な対策)。
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Excelでの文字化けを避けるため先頭にUTF-8 BOMを付与する。
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

// RFC4180相当の簡易CSVパーサー。ダブルクォート囲み・エスケープ("")・引用符内の
// カンマ/改行に対応する。先頭のUTF-8 BOMは呼び出し前にstripBom()で取り除いておくこと。
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // 末尾に改行が無い最終行も取りこぼさない(空文字列だけの末尾行は除く)。
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

// アップロードされたCSVファイルの文字コードを判定してデコードする。日本語Excelの
// CSVはShift_JIS(CP932)で保存されることが多いため、まずUTF-8として厳密デコードを
// 試み(fatal:true、不正なバイト列なら例外)、失敗したらShift_JISとして読み直す。
// どちらにも当てはまらない場合はUTF-8として扱い、置換文字(U+FFFD)が含まれていれば
// 文字化けの可能性を呼び出し側に伝える(TextDecoderはブラウザ・Node双方のWeb標準APIで、
// 追加ライブラリなしでShift_JISのデコードに対応している)。
export function decodeCsvFile(buffer: ArrayBuffer): { text: string; mojibakeSuspected: boolean } {
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(buffer), mojibakeSuspected: false };
  } catch {
    // UTF-8として不正なバイト列 → Shift_JISとして読み直す。
  }
  const text = new TextDecoder("shift_jis").decode(buffer);
  return { text, mojibakeSuspected: text.includes("�") };
}
