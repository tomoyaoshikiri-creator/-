import { describe, expect, it } from "vitest";
import { formatShavingDuration } from "../shavingDrill";

describe("formatShavingDuration", () => {
  it("分単位で割り切れる場合は「N分」と表示する", () => {
    expect(formatShavingDuration(180)).toBe("3分");
    expect(formatShavingDuration(300)).toBe("5分");
  });

  it("端数がある場合は「N分M秒」と表示する", () => {
    expect(formatShavingDuration(150)).toBe("2分30秒");
  });

  it("1分未満は「N秒」と表示する", () => {
    expect(formatShavingDuration(45)).toBe("45秒");
  });
});
