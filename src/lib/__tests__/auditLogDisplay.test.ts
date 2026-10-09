import { describe, expect, it } from "vitest";
import { AUDIT_ACTION_LABELS, describeAuditDetail } from "../auditLogDisplay";
import type { AuditAction } from "../database.types";

describe("AUDIT_ACTION_LABELS", () => {
  it("すべてのAuditActionにラベルが定義されている", () => {
    const actions: AuditAction[] = [
      "role_changed",
      "invite_issued",
      "invite_revoked",
      "member_removed",
      "team_leave",
      "team_deletion_requested",
      "ai_analysis_generated",
      "billing_plan_changed",
      "billing_subscription_canceled",
      "data_export",
      "players_bulk_imported",
    ];
    for (const action of actions) {
      expect(AUDIT_ACTION_LABELS[action]).toBeTruthy();
    }
  });
});

describe("describeAuditDetail", () => {
  it("role_changedはfrom→toを表示する", () => {
    expect(describeAuditDetail("role_changed", { from_role: "一般", to_role: "指導者" })).toBe("一般 → 指導者");
  });

  it("players_bulk_importedは件数を表示する", () => {
    expect(describeAuditDetail("players_bulk_imported", { total: 10, imported: 8 })).toBe("8件登録(対象10件)");
  });

  it("対応する項目が無い場合はnullを返す", () => {
    expect(describeAuditDetail("team_leave", {})).toBeNull();
  });

  it("detailがnull/undefinedでも例外にならない", () => {
    expect(describeAuditDetail("role_changed", null)).toBeNull();
    expect(describeAuditDetail("role_changed", undefined)).toBeNull();
  });
});
