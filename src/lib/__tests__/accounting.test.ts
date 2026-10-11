import { describe, expect, it } from "vitest";
import { ACCOUNTING_CATEGORY_TEMPLATE, ACCOUNTING_MAX_OFFICERS, formatYen } from "../accounting";

describe("formatYen", () => {
  it("3桁区切りで¥を付ける", () => {
    expect(formatYen(1000)).toBe("¥1,000");
    expect(formatYen(0)).toBe("¥0");
    expect(formatYen(1234567)).toBe("¥1,234,567");
  });

  it("小数は四捨五入する", () => {
    expect(formatYen(100.6)).toBe("¥101");
  });
});

describe("ACCOUNTING_CATEGORY_TEMPLATE", () => {
  it("収入・支出とも重複する項目名が無い", () => {
    for (const kind of ["income", "expense"] as const) {
      const names = ACCOUNTING_CATEGORY_TEMPLATE[kind];
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe("ACCOUNTING_MAX_OFFICERS", () => {
  it("会計担当は最大2名、会計監査は最大1名", () => {
    expect(ACCOUNTING_MAX_OFFICERS["担当"]).toBe(2);
    expect(ACCOUNTING_MAX_OFFICERS["監査"]).toBe(1);
  });
});
