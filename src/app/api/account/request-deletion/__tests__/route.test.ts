import { beforeEach, describe, expect, it, vi } from "vitest";

// アカウント完全削除(A-7)の重要な分岐を、Supabaseクライアントをモックして検証する。
// 「所属チームなし→即時削除」「最後の管理者→7日猶予のチーム退会をトリガーし、
// アカウント自体はまだ消さない」「最後の管理者でない→即座に脱退した上で
// (他に猶予チームがなければ)即時削除」の3パターンが本番でも最も間違えやすい分岐のため、
// ここを優先してカバーする。招待受諾フローのテストはこのPRのスコープ外(触っていないもの)。

type Row = Record<string, unknown>;
type TeamRow = {
  id: string;
  name: string;
  stripe_subscription_id: string | null;
  deletion_requested_at: string | null;
};

const { authGetUser, authSignInWithPassword, stripeSubscriptionsCancel } = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  authSignInWithPassword: vi.fn(),
  stripeSubscriptionsCancel: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: authGetUser,
      signInWithPassword: authSignInWithPassword,
    },
  }),
}));

vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({ subscriptions: { cancel: stripeSubscriptionsCancel } }),
}));

// makeFilterable/makeMutation: `.eq()`を任意回数チェーンでき、かつawaitもできる
// (thenable)、Supabaseのクエリビルダーを模した最小限のフェイク。
function makeFilterable<T extends Row>(getRows: () => T[], opts: { countOnly?: boolean } = {}) {
  const filters: [string, unknown][] = [];
  const matches = () => getRows().filter((r) => filters.every(([c, v]) => r[c] === v));
  const api = {
    eq(col: string, val: unknown) {
      filters.push([col, val]);
      return api;
    },
    async single() {
      const [first] = matches();
      return first ? { data: first, error: null } : { data: null, error: { message: "not found" } };
    },
    then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
      Promise.resolve()
        .then(() => resolve(opts.countOnly ? { count: matches().length, error: null } : { data: matches(), error: null }))
        .catch(reject);
    },
  };
  return api;
}

function makeMutation(apply: (filters: [string, unknown][]) => void) {
  const filters: [string, unknown][] = [];
  const api = {
    eq(col: string, val: unknown) {
      filters.push([col, val]);
      return api;
    },
    then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
      Promise.resolve()
        .then(() => {
          apply(filters);
          resolve({ error: null });
        })
        .catch(reject);
    },
  };
  return api;
}

const state = {
  teamMemberships: [] as Array<{ user_id: string; team_id: string; role: string }>,
  playerGuardians: [] as Array<{ profile_id: string; team_id: string }>,
  teams: new Map<string, TeamRow>(),
  accountDeletionRequests: new Map<string, { user_id: string; requested_at: string }>(),
  deletedUserIds: new Set<string>(),
  auditLogs: [] as Array<{ team_id: string; actor_id: string | null; action: string }>,
};

function resetState() {
  state.teamMemberships = [];
  state.playerGuardians = [];
  state.teams = new Map();
  state.accountDeletionRequests = new Map();
  state.deletedUserIds = new Set();
  state.auditLogs = [];
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      if (table === "team_memberships") {
        return {
          select(_cols: string, opts?: { count?: string; head?: boolean }) {
            return makeFilterable(() => state.teamMemberships, { countOnly: !!opts?.count });
          },
          delete() {
            return makeMutation((filters) => {
              state.teamMemberships = state.teamMemberships.filter(
                (r) => !filters.every(([c, v]) => (r as Row)[c] === v),
              );
            });
          },
        };
      }
      if (table === "player_guardians") {
        return {
          delete() {
            return makeMutation((filters) => {
              state.playerGuardians = state.playerGuardians.filter(
                (r) => !filters.every(([c, v]) => (r as Row)[c] === v),
              );
            });
          },
        };
      }
      if (table === "teams") {
        return {
          select() {
            return makeFilterable(() => Array.from(state.teams.values()));
          },
          update(patch: Partial<TeamRow>) {
            return makeMutation((filters) => {
              for (const [id, team] of state.teams) {
                if (filters.every(([c, v]) => (team as Row)[c] === v)) {
                  state.teams.set(id, { ...team, ...patch });
                }
              }
            });
          },
        };
      }
      if (table === "account_deletion_requests") {
        return {
          upsert(row: { user_id: string; requested_at: string }) {
            state.accountDeletionRequests.set(row.user_id, row);
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === "audit_logs") {
        return {
          insert(row: { team_id: string; actor_id: string | null; action: string }) {
            state.auditLogs.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table in test: ${table}`);
    },
    auth: {
      admin: {
        deleteUser: (uid: string) => {
          state.deletedUserIds.add(uid);
          return Promise.resolve({ error: null });
        },
      },
    },
  }),
}));

async function postRequestDeletion(password: string | undefined) {
  const { POST } = await import("../route");
  const request = new Request("http://localhost/api/account/request-deletion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return POST(request);
}

const USER_ID = "user-1";

describe("POST /api/account/request-deletion", () => {
  beforeEach(() => {
    resetState();
    authGetUser.mockReset();
    authSignInWithPassword.mockReset();
    stripeSubscriptionsCancel.mockReset();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";

    authGetUser.mockResolvedValue({ data: { user: { id: USER_ID, email: "user@example.test" } } });
    authSignInWithPassword.mockResolvedValue({ error: null });
  });

  it("パスワード未入力は400", async () => {
    const res = await postRequestDeletion(undefined);
    expect(res.status).toBe(400);
  });

  it("パスワードが誤っている場合は401で、削除系の処理は一切行わない", async () => {
    authSignInWithPassword.mockResolvedValue({ error: { message: "invalid" } });
    const res = await postRequestDeletion("wrong-password");
    expect(res.status).toBe(401);
    expect(state.deletedUserIds.size).toBe(0);
  });

  it("所属チームが1つもない場合は即座にauth.admin.deleteUserが呼ばれる", async () => {
    const res = await postRequestDeletion("correct-password");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, immediate: true });
    expect(state.deletedUserIds.has(USER_ID)).toBe(true);
  });

  it("最後の管理者でないチームは即座に脱退した上で、他に猶予チームがなければ即時削除される", async () => {
    state.teamMemberships = [
      { user_id: USER_ID, team_id: "team-1", role: "一般" },
      { user_id: "other-admin", team_id: "team-1", role: "管理者" },
    ];
    state.playerGuardians = [{ profile_id: USER_ID, team_id: "team-1" }];

    const res = await postRequestDeletion("correct-password");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, immediate: true });
    expect(state.teamMemberships.some((m) => m.user_id === USER_ID)).toBe(false);
    expect(state.playerGuardians.some((g) => g.profile_id === USER_ID)).toBe(false);
    expect(state.deletedUserIds.has(USER_ID)).toBe(true);
    expect(state.auditLogs).toContainEqual(
      expect.objectContaining({ team_id: "team-1", actor_id: USER_ID, action: "team_leave" }),
    );
  });

  it("最後の管理者であるチームは7日猶予のチーム退会をトリガーし、アカウント自体はまだ削除しない", async () => {
    state.teamMemberships = [{ user_id: USER_ID, team_id: "team-2", role: "管理者" }];
    state.teams.set("team-2", {
      id: "team-2",
      name: "最後の管理者チーム",
      stripe_subscription_id: "sub_123",
      deletion_requested_at: null,
    });
    stripeSubscriptionsCancel.mockResolvedValue({});

    const res = await postRequestDeletion("correct-password");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, immediate: false, pendingTeams: ["最後の管理者チーム"] });
    expect(stripeSubscriptionsCancel).toHaveBeenCalledWith("sub_123");
    expect(state.teams.get("team-2")?.deletion_requested_at).not.toBeNull();
    expect(state.accountDeletionRequests.has(USER_ID)).toBe(true);
    // 猶予期間中はteamDeletionJob.tsが完全削除した後に呼ばれる想定のため、この時点ではまだ削除しない。
    expect(state.deletedUserIds.has(USER_ID)).toBe(false);
    expect(state.auditLogs).toContainEqual(
      expect.objectContaining({ team_id: "team-2", actor_id: USER_ID, action: "team_deletion_requested" }),
    );
  });

  it("Stripe解約が失敗した場合は502を返し、チーム退会手続きも進めない", async () => {
    state.teamMemberships = [{ user_id: USER_ID, team_id: "team-3", role: "管理者" }];
    state.teams.set("team-3", {
      id: "team-3",
      name: "解約失敗チーム",
      stripe_subscription_id: "sub_fail",
      deletion_requested_at: null,
    });
    stripeSubscriptionsCancel.mockRejectedValue(new Error("stripe api error"));

    const res = await postRequestDeletion("correct-password");

    expect(res.status).toBe(502);
    expect(state.teams.get("team-3")?.deletion_requested_at).toBeNull();
    expect(state.deletedUserIds.has(USER_ID)).toBe(false);
  });
});
