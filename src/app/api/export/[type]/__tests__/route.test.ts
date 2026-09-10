import { beforeEach, describe, expect, it, vi } from "vitest";

// データエクスポート(B-6)の権限分岐(未認証401・非管理者403・不明種別400)と、
// 代表的な2種別(players=単純なteam_idスコープ、attendances=schedules/players経由の
// 手動join)が正しくCSV化されること、監査ログ(data_export)が記録されることを検証する。

type Row = Record<string, unknown>;

const { authGetUser, rpcMock } = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  rpcMock: vi.fn(),
}));

const state = {
  players: [] as Row[],
  schedules: [] as Row[],
  attendances: [] as Row[],
  auditLogs: [] as Row[],
};

function resetState() {
  state.players = [];
  state.schedules = [];
  state.attendances = [];
  state.auditLogs = [];
}

// eq/inを任意回数チェーンでき、awaitもできる(thenable)最小限のフェイククエリビルダー。
function makeQuery(getRows: () => Row[]) {
  const filters: [string, "eq" | "in", unknown][] = [];
  const api = {
    eq(col: string, val: unknown) {
      filters.push([col, "eq", val]);
      return api;
    },
    in(col: string, vals: unknown[]) {
      filters.push([col, "in", vals]);
      return api;
    },
    order() {
      return api;
    },
    then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
      Promise.resolve()
        .then(() => {
          const rows = getRows().filter((r) =>
            filters.every(([c, op, v]) => (op === "eq" ? r[c] === v : (v as unknown[]).includes(r[c]))),
          );
          resolve({ data: rows, error: null });
        })
        .catch(reject);
    },
  };
  return api;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: authGetUser },
    rpc: rpcMock,
    from: (table: string) => {
      if (table === "players") return { select: () => makeQuery(() => state.players) };
      if (table === "schedules") return { select: () => makeQuery(() => state.schedules) };
      if (table === "attendances") return { select: () => makeQuery(() => state.attendances) };
      if (table === "game_matches") return { select: () => makeQuery(() => []) };
      if (table === "daily_reports") return { select: () => makeQuery(() => []) };
      if (table === "notices") return { select: () => makeQuery(() => []) };
      if (table === "profiles") return { select: () => makeQuery(() => []) };
      throw new Error(`unexpected table in test: ${table}`);
    },
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      if (table === "audit_logs") {
        return {
          insert(row: Row) {
            state.auditLogs.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table in test: ${table}`);
    },
  }),
}));

async function getExport(type: string) {
  const { GET } = await import("../route");
  const request = new Request(`http://localhost/api/export/${type}`);
  return GET(request, { params: Promise.resolve({ type }) });
}

describe("GET /api/export/[type]", () => {
  beforeEach(() => {
    resetState();
    authGetUser.mockReset();
    rpcMock.mockReset();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";

    authGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "current_team_id") return Promise.resolve({ data: "team-1" });
      if (fn === "current_role") return Promise.resolve({ data: "管理者" });
      throw new Error(`unexpected rpc in test: ${fn}`);
    });
  });

  it("未認証は401", async () => {
    authGetUser.mockResolvedValue({ data: { user: null } });
    const res = await getExport("players");
    expect(res.status).toBe(401);
  });

  it("管理者でない場合は403", async () => {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "current_team_id") return Promise.resolve({ data: "team-1" });
      if (fn === "current_role") return Promise.resolve({ data: "一般" });
      throw new Error(`unexpected rpc in test: ${fn}`);
    });
    const res = await getExport("players");
    expect(res.status).toBe(403);
  });

  it("不明な種別は400", async () => {
    const res = await getExport("not-a-real-type");
    expect(res.status).toBe(400);
  });

  it("players: 他チームの選手を含まずCSVで返し、監査ログにdata_exportを記録する", async () => {
    state.players = [
      { team_id: "team-1", sei: "山田", mei: "太郎", sei_kana: null, mei_kana: null, grade: "3", number: "7", positions: ["GK"], status: "在籍", birthday: null, birthday_visible: true, created_at: "2026-01-01" },
      { team_id: "team-2", sei: "他チーム", mei: "選手", sei_kana: null, mei_kana: null, grade: "3", number: "1", positions: [], status: "在籍", birthday: null, birthday_visible: false, created_at: "2026-01-01" },
    ];

    const res = await getExport("players");
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("players.csv");
    expect(body).toContain("山田");
    expect(body).not.toContain("他チーム");
    expect(state.auditLogs).toContainEqual(
      expect.objectContaining({ team_id: "team-1", actor_id: "user-1", action: "data_export" }),
    );
  });

  it("attendances: schedule_id/player_idから予定タイトルと選手名を補ってCSV化する", async () => {
    state.schedules = [{ id: "sched-1", team_id: "team-1", title: "第1節", date: "2026-04-01" }];
    state.players = [{ id: "player-1", team_id: "team-1", sei: "鈴木", mei: "花子" }];
    state.attendances = [
      {
        schedule_id: "sched-1",
        player_id: "player-1",
        status: "出席",
        accompany: null,
        accompany_count: null,
        car: null,
        seats: null,
        note: null,
        updated_at: "2026-04-01",
      },
    ];

    const res = await getExport("attendances");
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("第1節");
    expect(body).toContain("鈴木 花子");
  });
});
