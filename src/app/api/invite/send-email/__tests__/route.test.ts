import { beforeEach, describe, expect, it, vi } from "vitest";

const { authGetUser, rpcMock, inviteMaybeSingle, sendTrackedEmailMock } = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  rpcMock: vi.fn(),
  inviteMaybeSingle: vi.fn(),
  sendTrackedEmailMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: authGetUser },
    rpc: rpcMock,
    from: (table: string) => {
      if (table === "invites") {
        return { select: () => ({ eq: () => ({ maybeSingle: inviteMaybeSingle }) }) };
      }
      throw new Error(`unexpected table in test: ${table}`);
    },
  }),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/emailNotify", () => ({ sendTrackedEmail: sendTrackedEmailMock }));

async function postSendEmail(body: unknown) {
  const { POST } = await import("../route");
  const request = new Request("http://localhost/api/invite/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(request);
}

describe("POST /api/invite/send-email", () => {
  beforeEach(() => {
    authGetUser.mockReset();
    rpcMock.mockReset();
    inviteMaybeSingle.mockReset();
    sendTrackedEmailMock.mockReset();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";

    authGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "current_team_id") return Promise.resolve({ data: "team-1" });
      if (fn === "current_role") return Promise.resolve({ data: "運営" });
      throw new Error(`unexpected rpc in test: ${fn}`);
    });
  });

  it("不正なメールアドレスは400", async () => {
    const res = await postSendEmail({ token: "tok", email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(sendTrackedEmailMock).not.toHaveBeenCalled();
  });

  it("招待発行権限がない(一般)場合は403", async () => {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "current_team_id") return Promise.resolve({ data: "team-1" });
      if (fn === "current_role") return Promise.resolve({ data: "一般" });
      throw new Error(`unexpected rpc in test: ${fn}`);
    });
    const res = await postSendEmail({ token: "tok", email: "a@example.test" });
    expect(res.status).toBe(403);
  });

  it("存在しない招待トークンは404", async () => {
    inviteMaybeSingle.mockResolvedValue({ data: null });
    const res = await postSendEmail({ token: "missing-token", email: "a@example.test" });
    expect(res.status).toBe(404);
  });

  it("有効期限切れの招待は400", async () => {
    inviteMaybeSingle.mockResolvedValue({
      data: { id: "inv-1", role: "一般", token: "tok", expires_at: "2000-01-01T00:00:00Z" },
    });
    const res = await postSendEmail({ token: "tok", email: "a@example.test" });
    expect(res.status).toBe(400);
  });

  it("正常系: sendTrackedEmailをteamId/eventType付きで呼び、成功すればok", async () => {
    inviteMaybeSingle.mockResolvedValue({
      data: { id: "inv-1", role: "指導者", token: "tok", expires_at: "2999-01-01T00:00:00Z" },
    });
    sendTrackedEmailMock.mockResolvedValue(true);

    const res = await postSendEmail({ token: "tok", email: "coach@example.test" });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true });
    expect(sendTrackedEmailMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ teamId: "team-1", recipientEmail: "coach@example.test", eventType: "invite_issued" }),
    );
  });

  it("メール送信失敗時は502", async () => {
    inviteMaybeSingle.mockResolvedValue({
      data: { id: "inv-1", role: "一般", token: "tok", expires_at: "2999-01-01T00:00:00Z" },
    });
    sendTrackedEmailMock.mockResolvedValue(false);

    const res = await postSendEmail({ token: "tok", email: "a@example.test" });
    expect(res.status).toBe(502);
  });
});
