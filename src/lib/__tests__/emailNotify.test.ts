import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }));
vi.mock("../email", () => ({ sendEmail: sendEmailMock }));

import { notifyTeamDeletionWarning, retryFailedEmailNotifications, sendTrackedEmail } from "../emailNotify";

type Row = Record<string, unknown>;

function fakeAdminClient(state: { emailNotifications: Row[]; teamMemberships?: Row[]; profiles?: Row[] }) {
  const from = vi.fn((table: string) => {
    if (table === "email_notifications") {
      return {
        insert: vi.fn((row: Row) => {
          state.emailNotifications.push(row);
          return Promise.resolve({ error: null });
        }),
        select() {
          return {
            eq: () => ({
              lt: () =>
                Promise.resolve({
                  data: state.emailNotifications
                    .map((row, id) => ({ id: String(id), ...row }) as Row)
                    .filter((row) => row.status === "failed" && (row.attempt_count as number) < 3),
                  error: null,
                }),
            }),
          };
        },
        update: vi.fn((patch: Row) => ({
          eq: (_col: string, id: string) => {
            const idx = Number(id);
            state.emailNotifications[idx] = { ...state.emailNotifications[idx], ...patch };
            return Promise.resolve({ error: null });
          },
        })),
      };
    }
    if (table === "team_memberships") {
      return {
        select: () => ({
          eq: (_col: string, teamId: string) =>
            Promise.resolve({ data: (state.teamMemberships ?? []).filter((m) => m.team_id === teamId), error: null }),
        }),
      };
    }
    if (table === "profiles") {
      return {
        select: () => ({
          in: (_col: string, ids: string[]) =>
            Promise.resolve({ data: (state.profiles ?? []).filter((p) => ids.includes(p.id as string)), error: null }),
        }),
      };
    }
    throw new Error(`unexpected table in test: ${table}`);
  });
  return { from } as never;
}

describe("sendTrackedEmail", () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
  });

  it("送信成功時はstatus=sentでsubject/html_bodyごとemail_notificationsへ記録する", async () => {
    sendEmailMock.mockResolvedValue({ success: true, messageId: "msg_1" });
    const state = { emailNotifications: [] as Row[] };
    const adminClient = fakeAdminClient(state);

    const ok = await sendTrackedEmail(adminClient, {
      teamId: "team-1",
      recipientEmail: "a@example.test",
      eventType: "invite_issued",
      subject: "件名",
      html: "<p>本文</p>",
    });

    expect(ok).toBe(true);
    expect(state.emailNotifications).toEqual([
      expect.objectContaining({
        team_id: "team-1",
        recipient_email: "a@example.test",
        event_type: "invite_issued",
        subject: "件名",
        html_body: "<p>本文</p>",
        status: "sent",
        resend_message_id: "msg_1",
        last_error: null,
      }),
    ]);
  });

  it("送信失敗時はstatus=failedでエラー内容を記録し、falseを返す", async () => {
    sendEmailMock.mockResolvedValue({ success: false, error: "boom" });
    const state = { emailNotifications: [] as Row[] };
    const adminClient = fakeAdminClient(state);

    const ok = await sendTrackedEmail(adminClient, {
      teamId: "team-1",
      recipientEmail: "a@example.test",
      eventType: "attendance_deadline",
      subject: "件名",
      html: "<p>本文</p>",
    });

    expect(ok).toBe(false);
    expect(state.emailNotifications).toEqual([expect.objectContaining({ status: "failed", last_error: "boom" })]);
  });
});

describe("retryFailedEmailNotifications", () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
  });

  it("失敗行を再送し、成功したらstatus=sentへ更新してattempt_countを増やす", async () => {
    sendEmailMock.mockResolvedValue({ success: true, messageId: "msg_2" });
    const state = {
      emailNotifications: [
        { recipient_email: "a@example.test", subject: "件名", html_body: "<p>本文</p>", status: "failed", attempt_count: 1 },
      ] as Row[],
    };
    const adminClient = fakeAdminClient(state);

    const recovered = await retryFailedEmailNotifications(adminClient);

    expect(recovered).toBe(1);
    expect(state.emailNotifications[0]).toMatchObject({ status: "sent", attempt_count: 2, resend_message_id: "msg_2" });
  });

  it("3回失敗した行は再送対象から外れる", async () => {
    const state = {
      emailNotifications: [
        { recipient_email: "a@example.test", subject: "件名", html_body: "<p>本文</p>", status: "failed", attempt_count: 3 },
      ] as Row[],
    };
    const adminClient = fakeAdminClient(state);

    const recovered = await retryFailedEmailNotifications(adminClient);

    expect(recovered).toBe(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("notifyTeamDeletionWarning", () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
  });

  it("チームメンバー全員(メールアドレスを持つ人だけ)へ送る", async () => {
    sendEmailMock.mockResolvedValue({ success: true });
    const state = {
      emailNotifications: [] as Row[],
      teamMemberships: [
        { user_id: "u1", team_id: "team-1" },
        { user_id: "u2", team_id: "team-1" },
      ] as Row[],
      profiles: [
        { id: "u1", email: "u1@example.test" },
        { id: "u2", email: null },
      ] as Row[],
    };
    const adminClient = fakeAdminClient(state);

    await notifyTeamDeletionWarning(adminClient, { teamId: "team-1", teamName: "テストチーム" });

    expect(state.emailNotifications).toHaveLength(1);
    expect(state.emailNotifications[0]).toMatchObject({ recipient_email: "u1@example.test", event_type: "team_deletion_warning" });
  });
});
