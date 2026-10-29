"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { cardClass, EmptyState, SectionLabel } from "@/components/ui/Card";
import { Fab } from "@/components/ui/Modal";
import { ChevronRightIcon } from "@/components/icons";
import { canCreatePoll } from "@/lib/permissions";
import { pollStatusLabel } from "@/lib/polls";
import { formatDateLabel } from "@/lib/format";
import type { Poll } from "@/lib/database.types";

// ============================================================================
// 検証専用: 投票一覧カードデザイン(PR #203)のPreview確認用ダミー表示ゲート。
// この一式(定数・関数・MOCK_POLLS)は`verify/poll-page-preview-mock`ブランチ
// 限定の検証コードであり、PR #203・mainへは取り込まない。
//
// 有効化条件は「表示中のホスト名がこの検証ブランチ専用のVercel Preview
// エイリアスと完全一致」かつ「URLに?previewMock=pollsが付与されている」の
// 両方を満たした場合のみ(どちらか一方が欠けると常に無効)。ホスト名は推測
// ではなく、このブランチを実際にpushして得られたVercelの実発行URL
// (alias: git-verify-poll-page-preview-mock-s-faith-creation.vercel.app)
// をそのまま使用している。本番ドメイン・他ブランチのPreviewでは一致しない
// ため、常に無効(実データ取得)側にフォールバックする(許可リスト方式)。
const MOCK_PREVIEW_HOSTNAME = "git-verify-poll-page-preview-mock-s-faith-creation.vercel.app";

function isMockPreviewActive(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.hostname !== MOCK_PREVIEW_HOSTNAME) return false;
  return new URLSearchParams(window.location.search).get("previewMock") === "polls";
}

// 表示確認用のダミー投票(Supabaseへは一切書き込まない、ローカル定数のみ)。
// 受付中4件・締切済み3件、通常の長さのタイトルと長文タイトル、異なる日付・
// ステータスを含む(2カラム表示・truncate表示の確認用)。
const MOCK_POLLS: Poll[] = [
  {
    id: "mock-open-1",
    team_id: "mock-team",
    created_by: null,
    title: "来週の練習メニューについて",
    description: null,
    multi_select: false,
    anonymous: false,
    allowed_roles: ["一般", "運営", "指導者", "管理者"],
    status: "open",
    closed_at: null,
    closed_by: null,
    created_at: "2026-10-20T09:00:00.000Z",
    updated_at: "2026-10-20T09:00:00.000Z",
  },
  {
    id: "mock-open-2",
    team_id: "mock-team",
    created_by: null,
    title: "次回の遠征に向けた集合時間と持ち物の確認(長文タイトルの表示確認用サンプルです)",
    description: null,
    multi_select: true,
    anonymous: false,
    allowed_roles: ["一般", "運営", "指導者", "管理者"],
    status: "open",
    closed_at: null,
    closed_by: null,
    created_at: "2026-10-22T09:00:00.000Z",
    updated_at: "2026-10-22T09:00:00.000Z",
  },
  {
    id: "mock-open-3",
    team_id: "mock-team",
    created_by: null,
    title: "ユニフォームのサイズ希望調査",
    description: null,
    multi_select: false,
    anonymous: true,
    allowed_roles: ["一般"],
    status: "open",
    closed_at: null,
    closed_by: null,
    created_at: "2026-10-25T09:00:00.000Z",
    updated_at: "2026-10-25T09:00:00.000Z",
  },
  {
    id: "mock-open-4",
    team_id: "mock-team",
    created_by: null,
    title: "保護者会の開催希望日",
    description: null,
    multi_select: false,
    anonymous: false,
    allowed_roles: ["一般", "運営", "指導者", "管理者"],
    status: "open",
    closed_at: null,
    closed_by: null,
    created_at: "2026-10-27T09:00:00.000Z",
    updated_at: "2026-10-27T09:00:00.000Z",
  },
  {
    id: "mock-closed-1",
    team_id: "mock-team",
    created_by: null,
    title: "夏合宿の参加可否",
    description: null,
    multi_select: false,
    anonymous: false,
    allowed_roles: ["一般", "運営", "指導者", "管理者"],
    status: "closed",
    closed_at: "2026-08-15T09:00:00.000Z",
    closed_by: null,
    created_at: "2026-08-01T09:00:00.000Z",
    updated_at: "2026-08-15T09:00:00.000Z",
  },
  {
    id: "mock-closed-2",
    team_id: "mock-team",
    created_by: null,
    title: "新チームロゴデザインの最終投票(候補A・B・Cから選択してください)",
    description: null,
    multi_select: false,
    anonymous: false,
    allowed_roles: ["一般", "運営", "指導者", "管理者"],
    status: "closed",
    closed_at: "2026-09-10T09:00:00.000Z",
    closed_by: null,
    created_at: "2026-09-01T09:00:00.000Z",
    updated_at: "2026-09-10T09:00:00.000Z",
  },
  {
    id: "mock-closed-3",
    team_id: "mock-team",
    created_by: null,
    title: "練習試合の対戦校候補",
    description: null,
    multi_select: true,
    anonymous: false,
    allowed_roles: ["運営", "指導者", "管理者"],
    status: "closed",
    closed_at: "2026-09-28T09:00:00.000Z",
    closed_by: null,
    created_at: "2026-09-20T09:00:00.000Z",
    updated_at: "2026-09-28T09:00:00.000Z",
  },
];
// ============================================================================

export default function PollListPage() {
  const router = useRouter();
  const { role } = useSession();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [mockActive, setMockActive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // 検証専用ゲート: 条件を満たす場合のみダミーデータをそのまま表示し、
    // Supabaseへの実データ取得を行わない(書き込みも一切発生しない)。
    if (isMockPreviewActive()) {
      setMockActive(true);
      setPolls(MOCK_POLLS);
      setLoading(false);
      return;
    }
    setMockActive(false);
    const supabase = createClient();
    const { data } = await supabase.from("polls").select("*").order("created_at", { ascending: false });
    setPolls(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openPolls = polls.filter((p) => p.status === "open");
  const closedPolls = polls.filter((p) => p.status === "closed");

  // disableNavは検証専用ダミー表示中のみtrueになる。見た目(カードの枠・文字・
  // 余白・アイコン)はPR #203の実装と完全に同一のまま、詳細への遷移リンクだけを
  // 無効化する(aタグをdivへ置き換え、実際の投票詳細へは遷移させない)。
  function PollRow({ poll, disableNav }: { poll: Poll; disableNav?: boolean }) {
    const content = (
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-sm truncate">{poll.title}</div>
          <div className="text-xs text-ink-soft mt-0.5">{formatDateLabel(poll.created_at.slice(0, 10))}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-none">
          <span
            className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
              poll.status === "open" ? "bg-orange/10 text-orange-text" : "bg-line text-ink-soft"
            }`}
          >
            {pollStatusLabel(poll.status)}
          </span>
          <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
        </div>
      </div>
    );
    if (disableNav) {
      return <div className={`${cardClass} block min-h-tap py-2 md:py-3`}>{content}</div>;
    }
    return (
      <Link href={`/poll/${poll.id}`} className={`${cardClass} block min-h-tap py-2 md:py-3`}>
        {content}
      </Link>
    );
  }

  return (
    <PageShell
      header={<AppHeader title="投票" variant="list" backHref="/team" />}
      fab={!mockActive && canCreatePoll(role) && <Fab onClick={() => router.push("/poll/new")} label="投票を作成" />}
    >
      {mockActive && (
        <div className="mb-3 rounded-control border border-danger bg-danger/10 px-3 py-2 text-xs font-bold text-danger-text">
          表示専用のダミーデータです。実際の投票データではありません(Supabaseへの読み書きは行われません)。
        </div>
      )}
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : polls.length === 0 ? (
        <EmptyState>まだ投票がありません</EmptyState>
      ) : (
        <div className="@container">
          {openPolls.length > 0 && (
            <>
              <SectionLabel>受付中</SectionLabel>
              <div className="grid grid-cols-1 gap-x-3 @[640px]:grid-cols-2">
                {openPolls.map((p) => (
                  <PollRow key={p.id} poll={p} disableNav={mockActive} />
                ))}
              </div>
            </>
          )}
          {closedPolls.length > 0 && (
            <>
              <SectionLabel>締切済み</SectionLabel>
              <div className="grid grid-cols-1 gap-x-3 @[640px]:grid-cols-2">
                {closedPolls.map((p) => (
                  <PollRow key={p.id} poll={p} disableNav={mockActive} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </PageShell>
  );
}
