import { describe, expect, it, vi } from "vitest";
import { recordAuditEvent } from "../auditLog";

function fakeAdminClient(insertResult: { error: unknown }) {
  const insert = vi.fn().mockResolvedValue(insertResult);
  const from = vi.fn().mockReturnValue({ insert });
  return { client: { from } as never, insert };
}

describe("recordAuditEvent", () => {
  it("audit_logsへ期待した形の行をinsertする", async () => {
    const { client, insert } = fakeAdminClient({ error: null });

    await recordAuditEvent(client, {
      teamId: "team-1",
      actorId: "user-1",
      action: "role_changed",
      targetType: "team_membership",
      targetId: "user-2",
      detail: { from_role: "一般", to_role: "指導者" },
    });

    expect(insert).toHaveBeenCalledWith({
      team_id: "team-1",
      actor_id: "user-1",
      action: "role_changed",
      target_type: "team_membership",
      target_id: "user-2",
      detail: { from_role: "一般", to_role: "指導者" },
    });
  });

  it("actorId=null(システム発)・detail省略でも動作する", async () => {
    const { client, insert } = fakeAdminClient({ error: null });

    await recordAuditEvent(client, {
      teamId: "team-1",
      actorId: null,
      action: "billing_subscription_canceled",
    });

    expect(insert).toHaveBeenCalledWith({
      team_id: "team-1",
      actor_id: null,
      action: "billing_subscription_canceled",
      target_type: null,
      target_id: null,
      detail: {},
    });
  });

  it("insertが失敗しても例外を投げない(本来の操作を止めないため)", async () => {
    const { client } = fakeAdminClient({ error: { message: "insert failed" } });

    await expect(
      recordAuditEvent(client, { teamId: "team-1", actorId: "user-1", action: "team_leave" }),
    ).resolves.toBeUndefined();
  });
});
