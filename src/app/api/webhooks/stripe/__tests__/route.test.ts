import { beforeEach, describe, expect, it, vi } from "vitest";

// StripeクライアントとSupabase(service_role)クライアントをモックし、
// /api/webhooks/stripeのPOSTハンドラを直接叩いて状態遷移を検証する(A-3/B-2)。
// 実際のStripe署名検証やネットワーク呼び出しは行わない。
//
// vi.mock()のファクトリはvitestによってimportより上へhoistされて実行されるため、
// ファクトリ内から参照する変数はvi.hoisted()経由で用意する(通常のconstだと
// TDZエラーになる)。

type FakeWebhookEventRow = { id: string; type: string; status: string };
type FakeTeamRow = {
  id: string;
  name: string;
  stripe_customer_id: string;
  plan: string;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
};
type FakeAuditLogRow = { team_id: string; actor_id: string | null; action: string; detail: unknown };
type FakeEmailNotificationRow = { team_id: string; recipient_email: string; event_type: string };

const { webhookEvents, teams, auditLogs, teamMemberships, profiles, emailNotifications, constructEvent, subscriptionsRetrieve } =
  vi.hoisted(() => ({
    webhookEvents: new Map<string, FakeWebhookEventRow>(),
    teams: new Map<string, FakeTeamRow>(),
    auditLogs: [] as FakeAuditLogRow[],
    teamMemberships: [] as Array<{ user_id: string; team_id: string; role: string }>,
    profiles: [] as Array<{ id: string; email: string | null }>,
    emailNotifications: [] as FakeEmailNotificationRow[],
    constructEvent: vi.fn(),
    subscriptionsRetrieve: vi.fn(),
  }));

function resetFakeDb() {
  webhookEvents.clear();
  teams.clear();
  auditLogs.length = 0;
  teamMemberships.length = 0;
  profiles.length = 0;
  emailNotifications.length = 0;
}

function seedTeam(customerId: string, overrides: Partial<FakeTeamRow> = {}) {
  teams.set(customerId, {
    id: `team-${customerId}`,
    name: `Team ${customerId}`,
    stripe_customer_id: customerId,
    plan: "お試し",
    stripe_subscription_id: null,
    subscription_status: null,
    ...overrides,
  });
}

vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    webhooks: { constructEvent },
    subscriptions: { retrieve: subscriptionsRetrieve },
  }),
  planForPriceId: (priceId: string | null) => {
    if (priceId === "price_middle_monthly") return "中間";
    return null;
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      if (table === "stripe_webhook_events") {
        return {
          insert(row: { id: string; type: string; payload_hash: string }) {
            if (webhookEvents.has(row.id)) {
              return Promise.resolve({ error: { code: "23505" } });
            }
            webhookEvents.set(row.id, { id: row.id, type: row.type, status: "processing" });
            return Promise.resolve({ error: null });
          },
          select() {
            return {
              eq(_col: string, id: string) {
                return {
                  maybeSingle: () => Promise.resolve({ data: webhookEvents.get(id) ?? null }),
                };
              },
            };
          },
          update(patch: Partial<FakeWebhookEventRow>) {
            return {
              eq(_col: string, id: string) {
                const existing = webhookEvents.get(id);
                if (existing) webhookEvents.set(id, { ...existing, ...patch });
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }
      if (table === "teams") {
        return {
          update(patch: Partial<FakeTeamRow>) {
            return {
              eq(_col: string, customerId: string) {
                return {
                  select() {
                    const existing = teams.get(customerId);
                    if (!existing) return Promise.resolve({ data: [], error: null });
                    teams.set(customerId, { ...existing, ...patch });
                    return Promise.resolve({ data: [{ id: existing.id }], error: null });
                  },
                };
              },
            };
          },
          select() {
            return {
              eq(_col: string, customerId: string) {
                return {
                  maybeSingle: () => Promise.resolve({ data: teams.get(customerId) ?? null, error: null }),
                };
              },
            };
          },
        };
      }
      if (table === "audit_logs") {
        return {
          insert(row: FakeAuditLogRow) {
            auditLogs.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === "team_memberships") {
        return {
          select() {
            return {
              eq(_col1: string, teamId: string) {
                return {
                  eq(_col2: string, role: string) {
                    return Promise.resolve({
                      data: teamMemberships.filter((m) => m.team_id === teamId && m.role === role),
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      }
      if (table === "profiles") {
        return {
          select() {
            return {
              in(_col: string, ids: string[]) {
                return Promise.resolve({ data: profiles.filter((p) => ids.includes(p.id)), error: null });
              },
            };
          },
        };
      }
      if (table === "email_notifications") {
        return {
          insert(row: FakeEmailNotificationRow) {
            emailNotifications.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table in test: ${table}`);
    },
  }),
}));

async function postWebhook(event: unknown) {
  const { POST } = await import("../route");
  constructEvent.mockReturnValue(event);
  const request = new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "test-signature" },
    body: JSON.stringify(event),
  });
  return POST(request);
}

function subscriptionEvent(overrides: {
  id: string;
  type: string;
  customerId: string;
  priceId: string | null;
  status: string;
}) {
  return {
    id: overrides.id,
    type: overrides.type,
    data: {
      object: {
        id: "sub_test",
        customer: overrides.customerId,
        status: overrides.status,
        items: { data: overrides.priceId ? [{ price: { id: overrides.priceId } }] : [] },
      },
    },
  };
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    resetFakeDb();
    constructEvent.mockReset();
    subscriptionsRetrieve.mockReset();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  });

  it("customer.subscription.updatedでplan/subscription_statusをteamsへ反映する", async () => {
    seedTeam("cus_1");
    const event = subscriptionEvent({
      id: "evt_1",
      type: "customer.subscription.updated",
      customerId: "cus_1",
      priceId: "price_middle_monthly",
      status: "active",
    });

    const res = await postWebhook(event);

    expect(res.status).toBe(200);
    expect(teams.get("cus_1")).toMatchObject({ plan: "中間", subscription_status: "active" });
    expect(webhookEvents.get("evt_1")?.status).toBe("succeeded");
    expect(auditLogs).toContainEqual(
      expect.objectContaining({ team_id: "team-cus_1", actor_id: null, action: "billing_plan_changed" }),
    );
  });

  it("past_dueへの遷移もそのままsubscription_statusへ反映する(機能制限はlib/planの別ロジックが担う)", async () => {
    seedTeam("cus_2", { plan: "中間", subscription_status: "active" });
    const event = subscriptionEvent({
      id: "evt_2",
      type: "customer.subscription.updated",
      customerId: "cus_2",
      priceId: "price_middle_monthly",
      status: "past_due",
    });

    const res = await postWebhook(event);

    expect(res.status).toBe(200);
    expect(teams.get("cus_2")?.subscription_status).toBe("past_due");
  });

  it("customer.subscription.deletedでお試しプランへ戻しstripe_subscription_idをクリアする", async () => {
    seedTeam("cus_3", { plan: "フル", stripe_subscription_id: "sub_old", subscription_status: "active" });
    const event = {
      id: "evt_3",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_old", customer: "cus_3", status: "canceled", items: { data: [] } } },
    };

    const res = await postWebhook(event);

    expect(res.status).toBe(200);
    expect(teams.get("cus_3")).toMatchObject({
      plan: "お試し",
      stripe_subscription_id: null,
      subscription_status: "canceled",
    });
    expect(auditLogs).toContainEqual(
      expect.objectContaining({ team_id: "team-cus_3", action: "billing_subscription_canceled" }),
    );
  });

  it("未知のPrice IDのときは5xxを返しStripeに再送させる(黙って200を返さない)", async () => {
    seedTeam("cus_4");
    const event = subscriptionEvent({
      id: "evt_4",
      type: "customer.subscription.updated",
      customerId: "cus_4",
      priceId: "price_unknown",
      status: "active",
    });

    const res = await postWebhook(event);

    expect(res.status).toBe(500);
    expect(webhookEvents.get("evt_4")?.status).toBe("failed");
    // 未知のPriceの場合はteams行を更新しない(不正な状態を書き込まない)。
    expect(teams.get("cus_4")).toMatchObject({ plan: "お試し" });
  });

  it("同一event.idの重複配信は副作用を起こさず即座にdeduplicatedを返す(冪等性)", async () => {
    seedTeam("cus_5");
    const event = subscriptionEvent({
      id: "evt_5",
      type: "customer.subscription.updated",
      customerId: "cus_5",
      priceId: "price_middle_monthly",
      status: "active",
    });

    const first = await postWebhook(event);
    expect(first.status).toBe(200);

    const second = await postWebhook(event);
    const secondBody = await second.json();

    expect(second.status).toBe(200);
    expect(secondBody).toMatchObject({ deduplicated: true });
    expect(teams.get("cus_5")).toMatchObject({ plan: "中間" });
  });

  it("invoice.payment_failedはparent.subscription_detailsからsubscriptionを解決して同期する", async () => {
    seedTeam("cus_6", { plan: "中間", subscription_status: "active" });
    teamMemberships.push({ user_id: "admin-6", team_id: "team-cus_6", role: "管理者" });
    profiles.push({ id: "admin-6", email: "admin6@example.test" });
    subscriptionsRetrieve.mockResolvedValue({
      id: "sub_6",
      customer: "cus_6",
      status: "past_due",
      items: { data: [{ price: { id: "price_middle_monthly" } }] },
    });
    const event = {
      id: "evt_6",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_1",
          parent: { type: "subscription_details", subscription_details: { subscription: "sub_6" } },
        },
      },
    };

    const res = await postWebhook(event);

    expect(res.status).toBe(200);
    expect(subscriptionsRetrieve).toHaveBeenCalledWith("sub_6");
    expect(teams.get("cus_6")?.subscription_status).toBe("past_due");
    expect(emailNotifications).toContainEqual(
      expect.objectContaining({
        team_id: "team-cus_6",
        recipient_email: "admin6@example.test",
        event_type: "billing_payment_failed",
      }),
    );
  });

  it("必須環境変数が欠けている場合は500を返す(黙ってスキップしない)", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await postWebhook(
      subscriptionEvent({
        id: "evt_7",
        type: "customer.subscription.updated",
        customerId: "cus_7",
        priceId: "price_middle_monthly",
        status: "active",
      }),
    );
    expect(res.status).toBe(500);
  });
});
