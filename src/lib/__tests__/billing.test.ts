import { describe, expect, it } from "vitest";
import { shouldUseBillingPortal } from "../billing";

// BILL-01: 解約後の再契約導線の判定ロジック。課金導線に直結するため、
// Stripeの取り得るsubscription.status全パターンを網羅的にテストする。
describe("shouldUseBillingPortal", () => {
  it.each(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"])(
    "%s のときはBilling Portalへ倒す(true)",
    (status) => {
      expect(shouldUseBillingPortal(status)).toBe(true);
    },
  );

  it.each(["canceled", "incomplete_expired"])("%s のときは新規Checkoutを表示する(false)", (status) => {
    expect(shouldUseBillingPortal(status)).toBe(false);
  });

  it("null(未契約)のときは新規Checkoutを表示する(false)", () => {
    expect(shouldUseBillingPortal(null)).toBe(false);
  });

  it("undefinedのときは新規Checkoutを表示する(false)", () => {
    expect(shouldUseBillingPortal(undefined)).toBe(false);
  });

  it("未知のstatusが来た場合はBilling Portal側へ倒す(true、安全側)", () => {
    expect(shouldUseBillingPortal("some_future_status")).toBe(true);
  });
});
