import { describe, expect, it } from "vitest";
import { parseCsv, stripBom, toCsv } from "../csv";
import { PLAYER_IMPORT_HEADERS, parsePlayerImportCsv, validatePlayerImportRows, type PlayerImportRowInput } from "../playerImport";

function row(overrides: Partial<PlayerImportRowInput> = {}): PlayerImportRowInput {
  return {
    sei: "山田",
    mei: "太郎",
    seiKana: "ヤマダ",
    meiKana: "タロウ",
    gradeLabel: "3年",
    number: "10",
    positionsText: "PG",
    birthday: "2015-04-01",
    ...overrides,
  };
}

describe("parsePlayerImportCsv", () => {
  it("想定の見出しならrowsを返す", () => {
    const result = parsePlayerImportCsv([
      ["氏", "名", "氏(カナ)", "名(カナ)", "学年", "背番号", "ポジション", "生年月日"],
      ["山田", "太郎", "", "", "", "", "", ""],
    ]);
    expect(result.headerError).toBeNull();
    expect(result.rows).toEqual([{ sei: "山田", mei: "太郎", seiKana: "", meiKana: "", gradeLabel: "", number: "", positionsText: "", birthday: "" }]);
  });

  it("見出しがテンプレートと異なればheaderErrorを返しrowsは空", () => {
    const result = parsePlayerImportCsv([["name", "firstname"]]);
    expect(result.headerError).not.toBeNull();
    expect(result.rows).toEqual([]);
  });

  it("空のCSVはheaderErrorを返す", () => {
    expect(parsePlayerImportCsv([]).headerError).not.toBeNull();
  });
});

describe("validatePlayerImportRows", () => {
  it("正常な行はerrorsが空でparsedが設定される", () => {
    const [result] = validatePlayerImportRows({
      rows: [row()],
      category: "小学生",
      sport: "ミニバスケットボール",
      existingPlayers: [],
    });
    expect(result.errors).toEqual([]);
    expect(result.parsed).toEqual({
      sei: "山田",
      mei: "太郎",
      sei_kana: "ヤマダ",
      mei_kana: "タロウ",
      grade: "3",
      number: "10",
      positions: ["PG"],
      birthday: "2015-04-01",
    });
  });

  it("氏・名が未入力ならエラー", () => {
    const [result] = validatePlayerImportRows({
      rows: [row({ sei: "", mei: "" })],
      category: "小学生",
      sport: "ミニバスケットボール",
      existingPlayers: [],
    });
    expect(result.errors).toContain("氏が未入力です");
    expect(result.errors).toContain("名が未入力です");
    expect(result.parsed).toBeUndefined();
  });

  it("学年ラベルがそのカテゴリーの選択肢に無ければエラー", () => {
    const [result] = validatePlayerImportRows({
      rows: [row({ gradeLabel: "中学1年" })],
      category: "小学生",
      sport: "ミニバスケットボール",
      existingPlayers: [],
    });
    expect(result.errors.some((e) => e.includes("学年"))).toBe(true);
  });

  it("学年概念の無いカテゴリー(その他)で学年が入力されていればエラー", () => {
    const [result] = validatePlayerImportRows({
      rows: [row({ gradeLabel: "3年" })],
      category: "その他",
      sport: "ミニバスケットボール",
      existingPlayers: [],
    });
    expect(result.errors.some((e) => e.includes("学年"))).toBe(true);
  });

  it("ポジションが競技の選択肢に無ければエラー", () => {
    const [result] = validatePlayerImportRows({
      rows: [row({ positionsText: "QB" })],
      category: "小学生",
      sport: "ミニバスケットボール",
      existingPlayers: [],
    });
    expect(result.errors.some((e) => e.includes("ポジション"))).toBe(true);
  });

  it("ポジションは「・」区切りで複数指定できる", () => {
    const [result] = validatePlayerImportRows({
      rows: [row({ positionsText: "PG・SG" })],
      category: "小学生",
      sport: "ミニバスケットボール",
      existingPlayers: [],
    });
    expect(result.parsed?.positions).toEqual(["PG", "SG"]);
  });

  it("生年月日の形式が不正ならエラー(実在しない日付も含む)", () => {
    const results = validatePlayerImportRows({
      rows: [row({ birthday: "2015/04/01" }), row({ birthday: "2015-02-30" })],
      category: "小学生",
      sport: "ミニバスケットボール",
      existingPlayers: [],
    });
    expect(results[0].errors.some((e) => e.includes("生年月日"))).toBe(true);
    expect(results[1].errors.some((e) => e.includes("生年月日"))).toBe(true);
  });

  it("既存選手と氏名・生年月日が完全一致なら重複エラー", () => {
    const [result] = validatePlayerImportRows({
      rows: [row()],
      category: "小学生",
      sport: "ミニバスケットボール",
      existingPlayers: [{ sei: "山田", mei: "太郎", birthday: "2015-04-01" }],
    });
    expect(result.errors.some((e) => e.includes("重複"))).toBe(true);
  });

  it("生年月日が未入力の行は、同姓同名の既存選手がいても重複エラーにしない", () => {
    const [result] = validatePlayerImportRows({
      rows: [row({ birthday: "" })],
      category: "小学生",
      sport: "ミニバスケットボール",
      existingPlayers: [{ sei: "山田", mei: "太郎", birthday: "2015-04-01" }],
    });
    expect(result.errors.some((e) => e.includes("重複"))).toBe(false);
  });

  it("CSV内の2行が氏名・生年月日とも一致する場合、2行目を重複エラーにする", () => {
    const results = validatePlayerImportRows({
      rows: [row(), row()],
      category: "小学生",
      sport: "ミニバスケットボール",
      existingPlayers: [],
    });
    expect(results[0].errors.some((e) => e.includes("重複"))).toBe(false);
    expect(results[1].errors.some((e) => e.includes("重複"))).toBe(true);
  });

  it("テンプレート生成(toCsv)→アップロード(parseCsv)→検証までの一連の流れが通る(結合テスト)", () => {
    const csv = toCsv(PLAYER_IMPORT_HEADERS, [
      ["山田", "太郎", "ヤマダ", "タロウ", "3年", "10", "PG", "2015-04-01"],
      ["鈴木", "花子", "", "", "", "", "", ""],
    ]);
    const { headerError, rows } = parsePlayerImportCsv(parseCsv(stripBom(csv)));
    expect(headerError).toBeNull();
    const results = validatePlayerImportRows({
      rows,
      category: "小学生",
      sport: "ミニバスケットボール",
      existingPlayers: [],
    });
    expect(results.every((r) => r.errors.length === 0)).toBe(true);
    expect(results[0].parsed).toMatchObject({ sei: "山田", mei: "太郎", grade: "3", positions: ["PG"] });
    expect(results[1].parsed).toMatchObject({ sei: "鈴木", mei: "花子", grade: null, positions: [] });
  });

  it("行番号は見出し行を1行目として2行目から始まる", () => {
    const results = validatePlayerImportRows({
      rows: [row(), row({ sei: "鈴木" })],
      category: "小学生",
      sport: "ミニバスケットボール",
      existingPlayers: [],
    });
    expect(results[0].rowNumber).toBe(2);
    expect(results[1].rowNumber).toBe(3);
  });
});
