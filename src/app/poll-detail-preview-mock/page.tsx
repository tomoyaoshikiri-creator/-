"use client";

// ============================================================================
// 検証専用: 投票詳細画面(PR #205 / src/app/(app)/poll/[id]/page.tsx)の
// デザイン刷新を、実データなしでiPhone・iPad・PCから確認するためのモック画面。
//
// 位置づけ: このファイルは意図的に`(app)`ルートグループの外(src/app直下)に
// 配置している。`(app)/layout.tsx`はSupabaseセッションを確認し、未ログイン時は
// サーバー側で/loginへリダイレクトする(既存の認証ガード、変更していない)。
// この検証ページはその階層の外にあるため、ログインなしで直接閲覧できる。
// 認証処理そのものには一切触れていない(既存のガードを迂回・変更していない。
// Next.jsのルートグループの仕組み上、単にその対象外の場所に置いているだけ)。
//
// Supabaseへの接続・書き込みは一切行わない(createClient等を一切importしていない)。
// 投票する/締め切る/削除するの各ボタンはUIの見た目・確認フローのみ再現し、
// 実際の送信・更新・削除・画面遷移は発生しない(下のhandleMockAction参照)。
//
// PR #205(src/app/(app)/poll/[id]/page.tsx)・共通コンポーネント本体
// (Card.tsx・SegButton.tsx等)は一切変更していない。
// ============================================================================

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cardClass, EmptyState, SectionLabel } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SegButton";
import { ChevronRightIcon } from "@/components/icons";
import { canVoteInPoll, pollStatusLabel } from "@/lib/polls";
import { formatFullDateLabel } from "@/lib/format";
import type { Poll, PollOption, Role } from "@/lib/database.types";

type ResultRow = { option_id: string; option_label: string; vote_count: number; voter_ids: string[] | null };

interface MockScenario {
  key: string;
  label: string;
  poll: Poll;
  options: PollOption[];
  results: ResultRow[] | null;
  votedOptionIds: Set<string>;
  viewerRole: Role;
  viewerUserId: string;
  profiles: Record<string, string>;
}

function makePoll(overrides: Partial<Poll> & Pick<Poll, "id" | "title" | "status">): Poll {
  const now = "2026-10-30T09:00:00.000Z";
  return {
    team_id: "mock-team",
    created_by: "mock-admin",
    description: null,
    multi_select: false,
    anonymous: false,
    allowed_roles: ["一般", "運営", "指導者", "管理者"],
    closed_at: null,
    closed_by: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeOptions(pollId: string, labels: string[]): PollOption[] {
  return labels.map((label, i) => ({
    id: `${pollId}-opt-${i}`,
    poll_id: pollId,
    label,
    position: i,
    created_at: "2026-10-30T09:00:00.000Z",
  }));
}

const SCENARIOS: MockScenario[] = [
  (() => {
    const pollId = "mock-unvoted";
    const options = makeOptions(pollId, ["日曜 10:00〜", "日曜 14:00〜", "来週 平日夜"]);
    return {
      key: "unvoted",
      label: "未回答",
      poll: makePoll({
        id: pollId,
        title: "次回練習の希望日程(モック)",
        description: "参加できる日程を教えてください。複数の候補から都合の良いものを選んでください。",
        status: "open",
        created_by: "mock-viewer",
      }),
      options,
      results: null,
      votedOptionIds: new Set<string>(),
      viewerRole: "管理者",
      viewerUserId: "mock-viewer",
      profiles: {},
    };
  })(),
  (() => {
    const pollId = "mock-voted";
    const options = makeOptions(pollId, ["参加する", "参加しない", "未定"]);
    return {
      key: "voted",
      label: "回答済み",
      poll: makePoll({
        id: pollId,
        title: "親睦会の出欠について(モック)",
        description: "日時: 11月15日(日) 18:00〜\n場所: 未定(後日連絡します)",
        status: "open",
      }),
      options,
      results: null,
      votedOptionIds: new Set([options[0].id]),
      viewerRole: "一般",
      viewerUserId: "mock-viewer",
      profiles: {},
    };
  })(),
  (() => {
    const pollId = "mock-closed";
    const options = makeOptions(pollId, ["デザインA", "デザインB", "デザインC"]);
    return {
      key: "closed",
      label: "締切済み",
      poll: makePoll({
        id: pollId,
        title: "新ユニフォームデザイン投票(モック、長めのタイトルで折り返し表示を確認するためのサンプルです)",
        status: "closed",
        closed_at: "2026-10-28T09:00:00.000Z",
        closed_by: "mock-admin",
        created_by: "mock-admin",
      }),
      options,
      results: [
        { option_id: options[0].id, option_label: options[0].label, vote_count: 8, voter_ids: ["u1", "u2"] },
        { option_id: options[1].id, option_label: options[1].label, vote_count: 3, voter_ids: null },
        { option_id: options[2].id, option_label: options[2].label, vote_count: 1, voter_ids: null },
      ],
      votedOptionIds: new Set([options[0].id]),
      viewerRole: "管理者",
      viewerUserId: "mock-viewer",
      profiles: { u1: "佐藤 太郎", u2: "鈴木 花子" },
    };
  })(),
  (() => {
    const pollId = "mock-ineligible";
    const options = makeOptions(pollId, ["賛成", "反対"]);
    return {
      key: "ineligible",
      label: "対象外",
      poll: makePoll({
        id: pollId,
        title: "指導者ミーティング日程調整(モック)",
        status: "open",
        allowed_roles: ["指導者", "管理者"],
      }),
      options,
      results: null,
      votedOptionIds: new Set<string>(),
      viewerRole: "一般",
      viewerUserId: "mock-viewer",
      profiles: {},
    };
  })(),
  (() => {
    const pollId = "mock-privileged";
    const options = makeOptions(pollId, ["弁当", "飲み物", "応援グッズ"]);
    return {
      key: "privileged",
      label: "結果早期閲覧(管理者特例)",
      poll: makePoll({
        id: pollId,
        title: "遠征時の差し入れ希望(モック、匿名投票)",
        status: "open",
        multi_select: true,
        anonymous: true,
        created_by: "mock-viewer",
      }),
      options,
      results: [
        { option_id: options[0].id, option_label: options[0].label, vote_count: 5, voter_ids: ["u1", "u2"] },
        { option_id: options[1].id, option_label: options[1].label, vote_count: 4, voter_ids: null },
        { option_id: options[2].id, option_label: options[2].label, vote_count: 2, voter_ids: null },
      ],
      votedOptionIds: new Set([options[0].id]),
      viewerRole: "管理者",
      viewerUserId: "mock-viewer",
      profiles: { u1: "佐藤 太郎", u2: "鈴木 花子" },
    };
  })(),
];

function MockHeader() {
  return (
    <div
      className="flex items-center gap-2 px-4 py-3 text-white"
      style={{ background: "linear-gradient(105deg, #123BDB 0%, #087CF0 40%, #08C6E8 100%)" }}
    >
      <ChevronRightIcon className="w-4 h-4 rotate-180" />
      <div className="font-bold text-[15px]">投票(モック)</div>
    </div>
  );
}

function ScenarioSwitcher({ current }: { current: string }) {
  return (
    <div className="flex gap-1.5 flex-wrap mb-3">
      {SCENARIOS.map((s) => (
        <a
          key={s.key}
          href={`/poll-detail-preview-mock?state=${s.key}`}
          className={`min-h-tap flex items-center px-3 py-1.5 rounded-control text-xs font-bold border ${
            s.key === current ? "bg-orange text-white border-orange" : "bg-paper text-ink-soft border-line"
          }`}
        >
          {s.label}
        </a>
      ))}
    </div>
  );
}

export default function PollDetailPreviewMockPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center text-sm text-ink-soft">読み込み中…</div>}>
      <PollDetailPreviewMockInner />
    </Suspense>
  );
}

function PollDetailPreviewMockInner() {
  const searchParams = useSearchParams();
  const requestedKey = searchParams.get("state") ?? "unvoted";
  const scenario = SCENARIOS.find((s) => s.key === requestedKey) ?? SCENARIOS[0];

  const { poll, options, results, profiles, viewerRole, viewerUserId } = scenario;
  const [selected, setSelected] = useState<Set<string>>(new Set(scenario.votedOptionIds));
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [mockMessage, setMockMessage] = useState<string | null>(null);

  function showMockMessage(text: string) {
    setMockMessage(text);
    setTimeout(() => setMockMessage((cur) => (cur === text ? null : cur)), 2500);
  }

  const canManage = poll.created_by === viewerUserId || viewerRole === "指導者" || viewerRole === "管理者";
  const canVote = poll.status === "open" && canVoteInPoll(viewerRole, poll.allowed_roles);
  const isPrivilegedEarlyView = poll.status === "open" && results !== null;
  const isPrivilegedAnonymousReveal = !!poll.anonymous && !!results?.some((r) => r.voter_ids !== null);

  function toggleOption(optionId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (poll.multi_select) {
        if (next.has(optionId)) next.delete(optionId);
        else next.add(optionId);
      } else {
        next.clear();
        next.add(optionId);
      }
      return next;
    });
  }

  function handleMockVote() {
    showMockMessage("(モック)実際には送信されません");
  }

  function handleMockClose() {
    if (!closeConfirm) {
      setCloseConfirm(true);
      setTimeout(() => setCloseConfirm(false), 3000);
      return;
    }
    setCloseConfirm(false);
    showMockMessage("(モック)実際には締め切られません");
  }

  function handleMockDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    setDeleteConfirm(false);
    showMockMessage("(モック)実際には削除されません");
  }

  const resultsByOption = new Map((results ?? []).map((r) => [r.option_id, r]));
  const maxVoteCount = Math.max(1, ...(results ?? []).map((r) => r.vote_count));

  return (
    <div className="min-h-dvh flex flex-col bg-paper">
      <MockHeader />
      <div className="flex-1 overflow-y-auto px-4.5 pt-4 pb-5 relative min-[700px]:px-8 min-[700px]:pt-6">
        <div className="mb-3 rounded-control border border-danger bg-danger/10 px-3 py-2 text-xs font-bold text-danger-text">
          表示専用のダミーデータです。実際の投票データではありません(Supabaseへの読み書きは行われません)。
        </div>

        <ScenarioSwitcher current={scenario.key} />

        {mockMessage && (
          <div className="mb-3 rounded-control border border-line bg-white px-3 py-2 text-xs font-bold text-ink-soft">
            {mockMessage}
          </div>
        )}

        <SectionLabel
          action={
            <span
              className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                poll.status === "open" ? "bg-orange/10 text-orange-text" : "bg-line text-ink-soft"
              }`}
            >
              {pollStatusLabel(poll.status)}
            </span>
          }
        >
          {poll.title}
        </SectionLabel>
        <div className={cardClass}>
          {poll.description && <div className="text-xs text-ink-soft mb-2 whitespace-pre-wrap">{poll.description}</div>}
          <div className="text-xs text-ink-soft">
            {formatFullDateLabel(poll.created_at.slice(0, 10))} ・ {poll.multi_select ? "複数選択可" : "単一選択"}
            {poll.anonymous && " ・ 匿名投票"}
          </div>
        </div>

        {canVote && (
          <>
            <SectionLabel>{selected.size > 0 && scenario.votedOptionIds.size > 0 ? "投票を変更する" : "投票する"}</SectionLabel>
            <div className={cardClass}>
              <div className="space-y-2">
                {options.map((o) => (
                  <label
                    key={o.id}
                    className="flex min-h-tap items-center gap-2.5 rounded-control border border-line px-3 py-2 text-sm font-bold"
                  >
                    <input
                      type={poll.multi_select ? "checkbox" : "radio"}
                      checked={selected.has(o.id)}
                      onChange={() => toggleOption(o.id)}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
              <SubmitButton onClick={handleMockVote}>
                {scenario.votedOptionIds.size > 0 ? "投票を更新する" : "投票する"}
              </SubmitButton>
            </div>
          </>
        )}

        {!canVote && poll.status === "open" && (
          <div className={cardClass}>
            <div className="text-xs text-ink-soft text-center py-1">あなたのロールはこの投票の対象外です</div>
          </div>
        )}

        <SectionLabel>結果</SectionLabel>
        {results === null ? (
          <div className={cardClass}>
            <div className="text-xs text-ink-soft text-center py-1">結果は締め切り後に公開されます</div>
          </div>
        ) : (
          <div className={cardClass}>
            {(isPrivilegedEarlyView || isPrivilegedAnonymousReveal) && (
              <div className="text-xs font-bold mb-2.5" style={{ color: "var(--danger-text)" }}>
                ※管理者限定の表示です(他のメンバーには公開されていません)
              </div>
            )}
            <div className="space-y-3">
              {options.map((o) => {
                const r = resultsByOption.get(o.id);
                const count = r?.vote_count ?? 0;
                const voterIds = r?.voter_ids ?? null;
                return (
                  <div key={o.id}>
                    <div className="flex items-center justify-between text-sm font-bold">
                      <span className="truncate">{o.label}</span>
                      <span className="font-mono text-ink-soft flex-none ml-2">{count}票</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-paper overflow-hidden">
                      <div
                        className="h-full rounded-full bg-orange"
                        style={{ width: `${(count / maxVoteCount) * 100}%` }}
                      />
                    </div>
                    {voterIds && voterIds.length > 0 && (
                      <div className="text-xs text-ink-soft mt-1">
                        {voterIds.map((id) => profiles[id] ?? "不明なユーザー").join("・")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {canManage && (
          <>
            <SectionLabel>管理</SectionLabel>
            <div className={cardClass}>
              {poll.status === "open" && (
                <button
                  type="button"
                  onClick={handleMockClose}
                  className="w-full min-h-tap text-center py-2 rounded-control font-bold text-xs border border-line bg-white text-ink-soft"
                >
                  {closeConfirm ? "もう一度タップで締め切り確定" : "この投票を締め切る"}
                </button>
              )}
              <button
                type="button"
                onClick={handleMockDelete}
                className={`w-full min-h-tap text-center py-2 rounded-control font-bold text-xs border bg-white ${
                  poll.status === "open" ? "mt-2" : ""
                }`}
                style={{ color: "var(--danger-text)", borderColor: "var(--danger)" }}
              >
                {deleteConfirm ? "もう一度タップで削除確定" : "この投票を削除する"}
              </button>
            </div>
          </>
        )}

        {options.length === 0 && <EmptyState>選択肢がありません</EmptyState>}
      </div>
    </div>
  );
}
