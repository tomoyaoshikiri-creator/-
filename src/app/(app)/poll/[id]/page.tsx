"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SegButton";
import { loadProfilesMap } from "@/lib/profiles";
import { markItemSeen } from "@/lib/itemBadges";
import { canVoteInPoll, isValidOptionSelection, pollStatusLabel } from "@/lib/polls";
import { formatFullDateLabel } from "@/lib/format";
import type { Poll, PollOption } from "@/lib/database.types";

type ResultRow = { option_id: string; option_label: string; vote_count: number; voter_ids: string[] | null };

export default function PollDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, role } = useSession();
  const toast = useToast();

  const [poll, setPoll] = useState<Poll | null>(null);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [myVotedOptionIds, setMyVotedOptionIds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [voting, setVoting] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: p }, { data: opts }, { data: myVotes }, { data: resultRows }, profMap] = await Promise.all([
      supabase.from("polls").select("*").eq("id", params.id).maybeSingle(),
      supabase.from("poll_options").select("*").eq("poll_id", params.id).order("position", { ascending: true }),
      supabase.from("poll_votes").select("option_id").eq("poll_id", params.id).eq("voter_id", userId),
      supabase.rpc("poll_results", { p_poll_id: params.id }),
      loadProfilesMap(supabase),
    ]);
    setPoll(p ?? null);
    setOptions(opts ?? []);
    const votedIds = new Set((myVotes ?? []).map((v) => v.option_id));
    setMyVotedOptionIds(votedIds);
    setSelected(votedIds);
    // optionsが2件以上ある前提のため、RPCが0件を返すのは「まだ結果を開示できない
    // (締切前かつSignature Edition管理者でもない)」ケースのみ。nullで区別する。
    setResults((resultRows ?? []).length > 0 ? (resultRows as ResultRow[]) : null);
    setProfiles(profMap);
    setLoading(false);
  }, [params.id, userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (poll) markItemSeen(userId, "poll", poll.id);
  }, [poll, userId]);

  const canManage = poll !== null && (poll.created_by === userId || role === "指導者" || role === "管理者");
  const canVote = poll !== null && poll.status === "open" && canVoteInPoll(role, poll.allowed_roles);
  // 本来は締切前には結果が出ないため、open中にresultsが取れている=Signature Editionの
  // 管理者特例が働いている状態。anonymousでも投票者名が見えているのも同じ特例による。
  const isPrivilegedEarlyView = poll?.status === "open" && results !== null;
  const isPrivilegedAnonymousReveal = !!poll?.anonymous && !!results?.some((r) => r.voter_ids !== null);

  function toggleOption(optionId: string) {
    if (!poll) return;
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

  async function handleVote() {
    if (!poll) return;
    const optionIds = Array.from(selected);
    if (!isValidOptionSelection(optionIds, poll.multi_select)) {
      toast(poll.multi_select ? "選択肢を選んでください" : "選択肢を1つ選んでください");
      return;
    }
    setVoting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("cast_poll_vote", { p_poll_id: poll.id, p_option_ids: optionIds });
    setVoting(false);
    if (error) {
      toast(`投票に失敗しました: ${error.message}`);
      return;
    }
    toast(myVotedOptionIds.size > 0 ? "投票を変更しました" : "投票しました");
    load();
  }

  async function handleClose() {
    if (!poll) return;
    if (!closeConfirm) {
      setCloseConfirm(true);
      setTimeout(() => setCloseConfirm(false), 3000);
      return;
    }
    setClosing(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("polls")
      .update({ status: "closed", closed_at: new Date().toISOString(), closed_by: userId, updated_at: new Date().toISOString() })
      .eq("id", poll.id);
    setClosing(false);
    if (error) {
      toast(`締め切りに失敗しました: ${error.message}`);
      return;
    }
    setCloseConfirm(false);
    toast("投票を締め切りました");
    load();
  }

  async function handleDelete() {
    if (!poll) return;
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from("polls").delete().eq("id", poll.id);
    setDeleting(false);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    toast("投票を削除しました");
    router.push("/poll");
  }

  const resultsByOption = new Map((results ?? []).map((r) => [r.option_id, r]));
  const maxVoteCount = Math.max(1, ...(results ?? []).map((r) => r.vote_count));

  return (
    <PageShell header={<AppHeader title="投票" variant="detail" backHref="/poll" />}>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : !poll ? (
        <EmptyState>投票が見つかりません</EmptyState>
      ) : (
        <>
          <SectionLabel
            action={
              <span
                className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                  poll.status === "open" ? "bg-orange/10 text-orange" : "bg-line text-ink-soft"
                }`}
              >
                {pollStatusLabel(poll.status)}
              </span>
            }
          >
            {poll.title}
          </SectionLabel>
          <Card>
            {poll.description && <div className="text-[12.5px] text-ink-soft mb-2 whitespace-pre-wrap">{poll.description}</div>}
            <div className="text-[11px] text-ink-soft">
              {formatFullDateLabel(poll.created_at.slice(0, 10))} ・ {poll.multi_select ? "複数選択可" : "単一選択"}
              {poll.anonymous && " ・ 匿名投票"}
            </div>
          </Card>

          {canVote && (
            <>
              <SectionLabel>{myVotedOptionIds.size > 0 ? "投票を変更する" : "投票する"}</SectionLabel>
              <Card>
                <div className="space-y-2">
                  {options.map((o) => (
                    <label key={o.id} className="flex items-center gap-2.5 text-[13.5px] font-bold">
                      <input
                        type={poll.multi_select ? "checkbox" : "radio"}
                        checked={selected.has(o.id)}
                        onChange={() => toggleOption(o.id)}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
                <SubmitButton onClick={handleVote} disabled={voting}>
                  {voting ? "送信中…" : myVotedOptionIds.size > 0 ? "投票を更新する" : "投票する"}
                </SubmitButton>
              </Card>
            </>
          )}

          {!canVote && poll.status === "open" && (
            <Card>
              <div className="text-[12.5px] text-ink-soft text-center py-1">あなたのロールはこの投票の対象外です</div>
            </Card>
          )}

          <SectionLabel>結果</SectionLabel>
          {results === null ? (
            <Card>
              <div className="text-[12.5px] text-ink-soft text-center py-1">結果は締め切り後に公開されます</div>
            </Card>
          ) : (
            <Card>
              {(isPrivilegedEarlyView || isPrivilegedAnonymousReveal) && (
                <div className="text-[10.5px] font-bold mb-2.5" style={{ color: "var(--danger)" }}>
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
                      <div className="flex items-center justify-between text-[13px] font-bold">
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
                        <div className="text-[10.5px] text-ink-soft mt-1">
                          {voterIds.map((id) => profiles[id] ?? "不明なユーザー").join("・")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {canManage && (
            <>
              <SectionLabel>管理</SectionLabel>
              <Card>
                {poll.status === "open" && (
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={closing}
                    className="w-full text-center py-2 rounded-lg font-bold text-[12.5px] border border-line bg-white text-ink-soft disabled:opacity-40"
                  >
                    {closing ? "締め切り中…" : closeConfirm ? "もう一度タップで締め切り確定" : "この投票を締め切る"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className={`w-full text-center py-2 rounded-lg font-bold text-[12.5px] border bg-white disabled:opacity-40 ${
                    poll.status === "open" ? "mt-2" : ""
                  }`}
                  style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                >
                  {deleting ? "削除中…" : deleteConfirm ? "もう一度タップで削除確定" : "この投票を削除する"}
                </button>
              </Card>
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
