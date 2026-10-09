import { GRADES_BY_CATEGORY, POSITIONS_BY_SPORT } from "@/lib/playerOptions";
import type { Grade, Position, TeamCategory, TeamSport } from "@/lib/database.types";

// 選手のCSV一括登録(クラウド指示書 M-1、Maxプラン限定)。
// このファイルはDBアクセスを持たない純粋な関数のみで構成し(parseCsv済みのstring[][]・
// チームのcategory/sport・既存選手一覧を引数で受け取る)、APIルート側がDB取得と
// 組み合わせて使う。クライアント側のプレビュー表示にもサーバー側の実登録にも、
// 必ずこのモジュールの結果をそのまま使うことで、プレビューと実登録の判定がズレない
// ようにする(「検証はすべてサーバー側で行う」という指示書の方針に合わせ、クライアントは
// このモジュールをそのまま呼ぶのではなくAPIの応答を表示するだけに留める)。

export const PLAYER_IMPORT_HEADERS = ["氏", "名", "氏(カナ)", "名(カナ)", "学年", "背番号", "ポジション", "生年月日"];
export const PLAYER_IMPORT_MAX_BYTES = 1_000_000; // 1MB
export const PLAYER_IMPORT_MAX_ROWS = 500;

export interface PlayerImportRowInput {
  sei: string;
  mei: string;
  seiKana: string;
  meiKana: string;
  gradeLabel: string;
  number: string;
  positionsText: string;
  birthday: string;
}

export interface PlayerImportParsedRow {
  sei: string;
  mei: string;
  sei_kana: string | null;
  mei_kana: string | null;
  grade: Grade | null;
  number: string | null;
  positions: Position[];
  birthday: string | null;
}

export interface PlayerImportRowResult {
  // CSVファイル上の行番号(1行目=見出し行、2行目から最初のデータ行)。
  rowNumber: number;
  input: PlayerImportRowInput;
  errors: string[];
  // errorsが空の場合のみ設定される(登録に使える値)。
  parsed?: PlayerImportParsedRow;
}

export interface PlayerImportParseResult {
  headerError: string | null;
  rows: PlayerImportRowInput[];
}

// parseCsv()済みの行配列(1行目=見出し)を、列位置ベースでPlayerImportRowInput[]に変換する。
// 見出し文言が想定と異なる場合はheaderErrorを返し、rowsは空にする(列の対応関係を
// 誤って解釈したまま処理を続けないため)。
export function parsePlayerImportCsv(csvRows: string[][]): PlayerImportParseResult {
  if (csvRows.length === 0) return { headerError: "CSVが空です", rows: [] };
  const header = csvRows[0];
  const headerMatches = PLAYER_IMPORT_HEADERS.every((h, i) => (header[i] ?? "").trim() === h);
  if (!headerMatches) {
    return {
      headerError: `1行目の見出しがテンプレートと異なります(想定: ${PLAYER_IMPORT_HEADERS.join(",")})`,
      rows: [],
    };
  }
  const rows = csvRows.slice(1).map((r) => ({
    sei: r[0] ?? "",
    mei: r[1] ?? "",
    seiKana: r[2] ?? "",
    meiKana: r[3] ?? "",
    gradeLabel: r[4] ?? "",
    number: r[5] ?? "",
    positionsText: r[6] ?? "",
    birthday: r[7] ?? "",
  }));
  return { headerError: null, rows };
}

function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// 各行を検証する。重複判定(氏+名+生年月日が完全一致、生年月日未入力の行は対象外)は、
// 既存選手とだけでなく、このCSV内の先に検証済みの行同士でも行う
// (同じ新入部員を誤って2回書いてしまうケースを防ぐため)。
export function validatePlayerImportRows(params: {
  rows: PlayerImportRowInput[];
  category: TeamCategory;
  sport: TeamSport;
  existingPlayers: { sei: string; mei: string; birthday: string | null }[];
}): PlayerImportRowResult[] {
  const { rows, category, sport, existingPlayers } = params;
  const gradeOptions = GRADES_BY_CATEGORY[category];
  const gradeLabelToValue = new Map(gradeOptions.map((g) => [g.label, g.value]));
  const positionOptions = new Set<string>(POSITIONS_BY_SPORT[sport]);

  const duplicateKey = (sei: string, mei: string, birthday: string) => `${sei}\u0000${mei}\u0000${birthday}`;
  const existingKeys = new Set(
    existingPlayers.filter((p) => p.birthday).map((p) => duplicateKey(p.sei, p.mei, p.birthday!)),
  );
  const seenInFile = new Set<string>();

  return rows.map((input, idx) => {
    const rowNumber = idx + 2;
    const errors: string[] = [];

    const sei = input.sei.trim();
    const mei = input.mei.trim();
    if (!sei) errors.push("氏が未入力です");
    if (!mei) errors.push("名が未入力です");

    const seiKana = input.seiKana.trim();
    const meiKana = input.meiKana.trim();

    let grade: string | null = null;
    const gradeLabel = input.gradeLabel.trim();
    if (gradeLabel) {
      if (gradeOptions.length === 0) {
        errors.push("このチームでは学年を設定できません(空欄にしてください)");
      } else {
        const value = gradeLabelToValue.get(gradeLabel);
        if (value === undefined) {
          errors.push(`学年「${gradeLabel}」が不正です(例: ${gradeOptions[0].label})`);
        } else {
          grade = value;
        }
      }
    }

    const number = input.number.trim();

    const positions: string[] = [];
    const positionsText = input.positionsText.trim();
    if (positionsText) {
      const tokens = positionsText
        .split(/[・,]/)
        .map((t) => t.trim())
        .filter((t) => t !== "");
      for (const token of tokens) {
        if (!positionOptions.has(token)) {
          errors.push(`ポジション「${token}」が不正です`);
        } else if (!positions.includes(token)) {
          positions.push(token);
        }
      }
    }

    let birthday: string | null = null;
    const birthdayText = input.birthday.trim();
    if (birthdayText) {
      if (!isValidDateStr(birthdayText)) {
        errors.push("生年月日の形式が不正です(例: 2015-04-01)");
      } else {
        birthday = birthdayText;
      }
    }

    if (sei && mei && birthday) {
      const key = duplicateKey(sei, mei, birthday);
      if (existingKeys.has(key) || seenInFile.has(key)) {
        errors.push("既存の選手、またはこのファイル内の別の行と氏名・生年月日が重複しています");
      } else {
        seenInFile.add(key);
      }
    }

    return {
      rowNumber,
      input,
      errors,
      parsed:
        errors.length === 0
          ? {
              sei,
              mei,
              sei_kana: seiKana || null,
              mei_kana: meiKana || null,
              grade: grade as Grade | null,
              number: number || null,
              positions: positions as Position[],
              birthday,
            }
          : undefined,
    };
  });
}
