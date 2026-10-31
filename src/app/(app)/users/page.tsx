"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { cardClass, EmptyState, SectionLabel } from "@/components/ui/Card";
import { SegButton, FieldLabel, inputClass } from "@/components/ui/SegButton";
import { hasCachedValue, useCachedState } from "@/lib/pageCache";
import { canAccessTab, canManageUsers } from "@/lib/permissions";
import { formatDateLabel, formatDateTimeLabel, playerFullName } from "@/lib/format";
import type { Invite, Player, Role, TeamMember, UserStatus } from "@/lib/database.types";

const ROLE_OPTIONS: Role[] = ["一般", "運営", "指導者", "管理者"];
const ROLE_SORT_ORDER: Record<Role, number> = { 管理者: 0, 指導者: 1, 運営: 2, 一般: 3 };
const STATUS_OPTIONS: UserStatus[] = ["アクティブ", "休止"];

export default function UsersPage() {
  const router = useRouter();
  const { userId, teamId, role } = useSession();
  const toast = useToast();
  const isAdmin = canManageUsers(role);
  const cacheKey = useCallback((field: string) => `users:${isAdmin}:${field}`, [isAdmin]);
  const [profiles, setProfiles] = useCachedState<TeamMember[]>(cacheKey("profiles"), []);
  const [invites, setInvites] = useCachedState<Invite[]>(cacheKey("invites"), []);
  const [players, setPlayers] = useCachedState<Player[]>(cacheKey("players"), []);
  const [guardianLinks, setGuardianLinks] = useCachedState<Record<string, string[]>>(
    cacheKey("guardianLinks"),
    {},
  );
  const [loading, setLoading] = useState(() => !hasCachedValue(cacheKey("profiles")) && !hasCachedValue(cacheKey("invites")));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<"一般" | "指導者" | null>(null);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [emailDrafts, setEmailDrafts] = useState<Record<string, string>>({});
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!hasCachedValue(cacheKey("profiles")) && !hasCachedValue(cacheKey("invites"))) setLoading(true);
    if (isAdmin) {
      const [{ data: p }, { data: inv }, { data: pl }, { data: links }] = await Promise.all([
        supabase.rpc("list_team_members"),
        supabase.from("invites").select("*").order("created_at", { ascending: false }),
        supabase.from("players").select("*").eq("status", "在籍"),
        supabase.from("player_guardians").select("player_id, profile_id"),
      ]);
      setProfiles(p ?? []);
      setInvites(inv ?? []);
      setPlayers(pl ?? []);
      const linkMap: Record<string, string[]> = {};
      (links ?? []).forEach((l) => {
        (linkMap[l.profile_id] ??= []).push(l.player_id);
      });
      setGuardianLinks(linkMap);
    } else {
      // 運営は保護者用(role='一般')の招待リンクしか見えない(RLSでも絞っている)。
      const { data: inv } = await supabase.from("invites").select("*").order("created_at", { ascending: false });
      setInvites(inv ?? []);
    }
    setLoading(false);
  }, [isAdmin, cacheKey, setProfiles, setInvites, setPlayers, setGuardianLinks]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canAccessTab(role, "users")) router.replace("/home");
  }, [role, router]);

  async function toggleGuardian(profileId: string, playerId: string) {
    const supabase = createClient();
    const linked = (guardianLinks[profileId] ?? []).includes(playerId);
    const { error } = linked
      ? await supabase
          .from("player_guardians")
          .delete()
          .eq("profile_id", profileId)
          .eq("player_id", playerId)
      : await supabase.from("player_guardians").insert({ team_id: teamId, profile_id: profileId, player_id: playerId });
    if (error) {
      toast.error(`更新に失敗しました: ${error.message}`);
      return;
    }
    setGuardianLinks((m) => ({
      ...m,
      [profileId]: linked
        ? (m[profileId] ?? []).filter((id) => id !== playerId)
        : [...(m[profileId] ?? []), playerId],
    }));
  }

  async function handleRoleChange(id: string, role: Role) {
    const supabase = createClient();
    const { error } = await supabase.rpc("update_team_member", { target_user_id: id, new_role: role });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("権限を更新しました");
    load();
  }

  async function handleStatusChange(id: string, status: UserStatus) {
    const supabase = createClient();
    const { error } = await supabase.rpc("update_team_member", { target_user_id: id, new_status: status });
    if (error) {
      toast.error(`更新に失敗しました: ${error.message}`);
      return;
    }
    toast.success("ステータスを更新しました");
    load();
  }

  async function handleDelete(id: string) {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    setDeleteConfirmId(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("remove_team_member", { target_user_id: id });
    if (error) {
      toast.error(error.message ?? "削除に失敗しました");
      return;
    }
    toast.success("ユーザーを削除しました");
    load();
  }

  async function generateInvite(role: "一般" | "指導者") {
    setGenerating(role);
    const supabase = createClient();
    const { error } = await supabase.from("invites").insert({ team_id: teamId, role, created_by: userId });
    setGenerating(null);
    if (error) {
      toast.error(`発行に失敗しました: ${error.message}`);
      return;
    }
    toast.success("招待リンクを発行しました");
    load();
  }

  // navigator.clipboard.writeText()は非対応ブラウザ・セキュアコンテキスト外・iOSの
  // ホーム画面追加アプリ(PWA)など一部環境で使えない/黙って失敗することがある。
  // 以前はエラーを一切見ずに常に「コピーしました」と表示していたため、実際には
  // 何もコピーされていないのに成功したように見えるのが「コピーできない」不具合の原因
  // だった。ここでは実際に成功した場合のみ成功トーストを出し、失敗時は非対応環境向けの
  // execCommand("copy")フォールバックを試し、それも失敗したら手動コピーを促す。
  async function copyInviteUrl(token: string) {
    const url = `${origin}/invite/${token}`;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("リンクをコピーしました");
        return;
      } catch {
        // フォールバックへ続行
      }
    }
    const textarea = document.createElement("textarea");
    textarea.value = url;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    document.body.removeChild(textarea);
    if (copied) {
      toast.success("リンクをコピーしました");
    } else {
      toast.error("コピーに失敗しました。上の欄を長押しして手動でコピーしてください");
    }
  }

  // 招待リンクをメールで送る(B-4)。リンク自体は複数人が使い回せる共有リンクのため、
  // 送信してもinvites側の状態は変わらない(コピーして手動共有する既存の導線と並存する)。
  async function sendInviteEmail(inviteId: string, token: string) {
    const email = (emailDrafts[inviteId] ?? "").trim();
    if (!email) {
      toast.warning("メールアドレスを入力してください");
      return;
    }
    setSendingEmailId(inviteId);
    try {
      const res = await fetch("/api/invite/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "送信に失敗しました");
        return;
      }
      toast.success("招待メールを送信しました");
      setEmailDrafts((d) => ({ ...d, [inviteId]: "" }));
    } finally {
      setSendingEmailId(null);
    }
  }

  async function handleRevoke(id: string) {
    if (revokeConfirmId !== id) {
      setRevokeConfirmId(id);
      setTimeout(() => setRevokeConfirmId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    setRevokeConfirmId(null);
    const supabase = createClient();
    const { error } = await supabase.from("invites").delete().eq("id", id);
    if (error) {
      toast.error(`取り消しに失敗しました: ${error.message}`);
      return;
    }
    toast.success("招待リンクを取り消しました");
    load();
  }

  // 招待リンクは複数人が使い回せるため、一度使われたかどうかではなく有効期限だけで表示を絞る
  const visibleInvites = invites.filter((inv) => new Date(inv.expires_at) > new Date());
  const hasVisibleInvites = visibleInvites.length > 0;

  // 権限(管理者→指導者→運営→一般)でグループ分けして表示する。同じ権限内では登録順(RPCの並び)を保つ。
  const sortedProfiles = [...profiles].sort((a, b) => ROLE_SORT_ORDER[a.role] - ROLE_SORT_ORDER[b.role]);

  // 招待関連の2カード(発行・一覧)。一覧が存在しない場合は1カードのみのため、
  // 常に2カラム化すると空の片カラムができてしまう。表示するカードが2つ揃った
  // 場合だけ2カラムにする(hasVisibleInvitesで判定)。
  //
  // 切替幅は設定画面等で使っている640pxに固定せず、このカードの内容
  // (「保護者用/指導者用リンク」の2つのSegButtonを並べる行、URL入力欄+コピー、
  // メール入力欄+送信、の各行)が半分幅でも窮屈にならない720pxを採用する。
  const inviteSections = (
    <div className="@container">
      <div
        className={
          hasVisibleInvites
            ? "flex flex-col gap-3 @[720px]:grid @[720px]:grid-cols-2 @[720px]:items-start"
            : "flex flex-col gap-3"
        }
      >
        <div>
          <SectionLabel>招待リンクを発行</SectionLabel>
          <div className={cardClass}>
            <div className="flex gap-2">
              <SegButton onClick={() => generateInvite("一般")} disabled={generating === "一般"}>
                保護者用リンク
              </SegButton>
              {isAdmin && (
                <SegButton onClick={() => generateInvite("指導者")} disabled={generating === "指導者"}>
                  指導者用リンク
                </SegButton>
              )}
            </div>
            {!isAdmin && <div className="text-xs text-ink-soft mt-2">指導者用リンクの発行は管理者のみ行えます。</div>}
          </div>
        </div>

        {hasVisibleInvites && (
          <div>
            <div className={cardClass}>
              {visibleInvites.map((inv) => (
                <div key={inv.id} className="mb-3 last:mb-0">
                  <div className="text-xs font-bold">{inv.role === "一般" ? "保護者用" : "指導者用"}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <input readOnly className={inputClass("text-[11px]")} value={`${origin}/invite/${inv.token}`} />
                    <button
                      type="button"
                      onClick={() => copyInviteUrl(inv.token)}
                      className="flex-none text-orange-text font-bold text-xs"
                    >
                      コピー
                    </button>
                  </div>
                  <div className="text-[10.5px] text-ink-soft mt-1">
                    有効期限: {formatDateLabel(inv.expires_at.slice(0, 10))}まで(このリンクは複数人が登録に使えます)
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <input
                      type="email"
                      placeholder="メールで送る(任意)"
                      className={inputClass("text-[11px]")}
                      value={emailDrafts[inv.id] ?? ""}
                      onChange={(e) => setEmailDrafts((d) => ({ ...d, [inv.id]: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => sendInviteEmail(inv.id, inv.token)}
                      disabled={sendingEmailId === inv.id}
                      className="flex-none text-orange-text font-bold text-xs"
                    >
                      送信
                    </button>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleRevoke(inv.id)}
                      className="mt-1.5 text-[11px] font-bold"
                      style={{ color: "var(--danger-text)" }}
                    >
                      {revokeConfirmId === inv.id ? "もう一度タップで取り消し確定" : "このリンクを取り消す"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <PageShell header={<AppHeader title={isAdmin ? "ユーザー管理" : "メンバーを招待"} variant="detail" backHref="/home" />}>
      {isAdmin && (
        <>
          <SectionLabel>メンバー</SectionLabel>
          <div className="text-xs text-ink-soft mb-2.5">
            ※新規登録者は自動的に「一般」権限で登録されます。ここで権限を変更してください。
          </div>
          <div className={cardClass}>
            {loading ? (
              <EmptyState>読み込み中…</EmptyState>
            ) : (
              sortedProfiles.map((u) => (
                <div key={u.id} className="border-b border-line last:border-b-0">
                  <div
                    className="flex min-h-tap items-center gap-2.5 py-2 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
                  >
                    <div className="flex-1">
                      <div className="font-bold text-sm">
                        {u.name}
                        {u.id === userId ? "(自分)" : ""}
                      </div>
                      <div className="text-xs text-ink-soft mt-0.5">
                        {u.status}
                        {u.last_active_at && ` ・最終操作 ${formatDateTimeLabel(u.last_active_at)}`}
                      </div>
                    </div>
                    <select
                      className="w-auto px-2 py-1.5 text-xs border border-line rounded-control bg-white"
                      value={u.role}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  {expandedId === u.id && (
                    <div className="pb-3.5">
                      <div className="text-xs text-ink-soft mb-2.5">
                        表示名は本人が「設定」から変更できます。管理者による変更はできません。
                      </div>

                      <div className="@container">
                        <div className={u.email ? "grid grid-cols-1 gap-x-3 @[480px]:grid-cols-2" : ""}>
                          {u.email && (
                            <div>
                              <FieldLabel>メールアドレス</FieldLabel>
                              <div className="text-[12.5px] text-ink mb-2.5">{u.email}</div>
                            </div>
                          )}
                          <div>
                            <FieldLabel>ステータス</FieldLabel>
                            <select
                              className={inputClass("mb-2.5")}
                              value={u.status}
                              onChange={(e) => handleStatusChange(u.id, e.target.value as UserStatus)}
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <FieldLabel>紐付ける選手</FieldLabel>
                      {players.length === 0 ? (
                        <div className="text-xs text-ink-soft mb-2.5">在籍中の選手がいません</div>
                      ) : (
                        <div className="flex gap-1 flex-wrap mb-2.5">
                          {players.map((p) => {
                            const linked = (guardianLinks[u.id] ?? []).includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleGuardian(u.id, p.id);
                                }}
                                className={`flex-none min-h-tap px-3 py-1 rounded-control text-[11px] font-bold border ${
                                  linked ? "bg-orange text-white border-orange" : "bg-paper text-ink-soft border-line"
                                }`}
                              >
                                {playerFullName(p)}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {u.id === userId ? (
                        <div className="text-xs text-ink-soft">自分自身は削除できません。</div>
                      ) : u.role === "管理者" ? (
                        <div className="text-xs text-ink-soft">
                          管理者ユーザーは削除できません。削除するには先に権限を変更してください。
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDelete(u.id)}
                          className="w-full min-h-tap text-center py-2 rounded-control font-bold text-[12.5px] border bg-white"
                          style={{ color: "var(--danger-text)", borderColor: "var(--danger)" }}
                        >
                          {deleteConfirmId === u.id ? "もう一度タップで削除確定" : "このユーザーを削除する"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {inviteSections}
    </PageShell>
  );
}
