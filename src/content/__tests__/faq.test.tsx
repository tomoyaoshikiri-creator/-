import { describe, expect, it } from "vitest";
import { isValidElement, type ReactNode } from "react";
import { FAQ_CATEGORIES } from "../faq";
import { PLAN_CONFIG } from "@/lib/plan";

// レンダリングせずにReactNodeからテキストだけを取り出す(jsdom非依存)。
function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return extractText(props.children);
  }
  return "";
}

describe("FAQ_CATEGORIES", () => {
  it("「要確認」を含む項目を一切公開しない", () => {
    for (const category of FAQ_CATEGORIES) {
      for (const item of category.items) {
        expect(extractText(item.question)).not.toContain("要確認");
        expect(extractText(item.answer)).not.toContain("要確認");
      }
    }
  });

  it("各カテゴリーのidはユニークで、各項目のidもカテゴリー内でユニーク", () => {
    const categoryIds = FAQ_CATEGORIES.map((c) => c.id);
    expect(new Set(categoryIds).size).toBe(categoryIds.length);
    for (const category of FAQ_CATEGORIES) {
      const itemIds = category.items.map((i) => i.id);
      expect(new Set(itemIds).size).toBe(itemIds.length);
    }
  });

  it("容量表示が実際のプラン設定(plan.tsのPLAN_CONFIG)と一致する", () => {
    const storageItem = FAQ_CATEGORIES.find((c) => c.id === "billing")!.items.find((i) => i.id === "storage-limit")!;
    const text = extractText(storageItem.answer);
    expect(text).toContain("100MB");
    expect(text).toContain("1GB");
    expect(text).toContain("5GB");
    expect(text).toContain("10GB");
    // 文中の数値が実際の定数とズレていないことも確認する(104857600B=100MiB等)。
    expect(PLAN_CONFIG["お試し"].storageLimitBytes).toBe(100 * 1024 * 1024);
    expect(PLAN_CONFIG["中間"].storageLimitBytes).toBe(1 * 1024 * 1024 * 1024);
    expect(PLAN_CONFIG["フル"].storageLimitBytes).toBe(5 * 1024 * 1024 * 1024);
    expect(PLAN_CONFIG["フルプラス"].storageLimitBytes).toBe(5 * 1024 * 1024 * 1024);
    expect(PLAN_CONFIG["Max"].storageLimitBytes).toBe(10 * 1024 * 1024 * 1024);
  });
});
