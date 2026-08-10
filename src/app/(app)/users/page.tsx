"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { CurrentUserBadge } from "@/components/CurrentUserBadge";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { SegButton, FieldLabel, inputClass } from "@/components/ui/SegButton";
import { canAccessTab } from "@/lib/permissions";
import { formatDateLabel, playerFullName } from "@/lib/format";
import type { Invite, Player, Role, TeamMember, UserStatus } from "@/lib/database.types";

const ROLE_OPTIONS: Role[] = ["一般", "役員", "指導者", "管理者"];
const STATUS_OPTIONS: UserStatus[] = ["アクティブ", "休止"];

export default function UsersPage() {
  const router = useRouter();
  const { userId, teamId, role } = useSession();
  const toast = useToast();
  const [profiles, setProfiles] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [guardianLinks, setGuardianLinks] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<"一般" | "指導者" | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
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
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canAccessTab(role, "users")) router.replace("/schedule");
  }, [role, router]);

  async function handleNameChange(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      toast("表示名を入力してください");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ name: trimmed }).eq("id", id);
    if (error) {
      toast(`保存に失敗しました: ${error.message}`);
      return;
    }
    toast("表示名を更新しました");
    load();
  }

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
      toast(`更新に失敗しました: ${error.message}`);
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
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    if (error) {
      toast(error.message);
      return;
    }
    toast("権限を更新しました");
    load();
  }

  async function handleStatusChange(id: string, status: UserStatus) {
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }
    toast("ステータスを更新しました");
    load();
  }

  async function handleDelete(id: string) {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    setDeleteConfirmId(null);
    const res = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId: id }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "削除に失敗しました" }));
      toast(error ?? "削除に失敗しました");
      return;
    }
    toast("ユーザーを削除しました");
    load();
  }

  async function generateInvite(role: "一般" | "指導者") {
    setGenerating(role);
    const supabase = createClient();
    const { error } = await supabase.from("invites").insert({ team_id: teamId, role, created_by: userId });
    setGenerating(null);
    if (error) {
      toast(`発行に失敗しました: ${error.message}`);
      return;
    }
    toast("招待リンクを発行しました");
    load();
  }

  function copyInviteUrl(token: string) {
    const url = `${origin}/invite/${token}`;
    navigator.clipboard?.writeText(url);
    toast("リンクをコピーしました");
  }

  // 招待リンクは複数人が使い回せるため、一度使われたかどうかではなく有効期限だけで表示を絞る
  const visibleInvites = invites.filter((inv) => new Date(inv.expires_at) > new Date());

  return (
    <PageShell header={<AppHeader title="ユーザー管理" rightSlot={<CurrentUserBadge />} accessBadge="admin" />}>
      <SectionLabel>招待リンクを発行</SectionLabel>
      <Card>
        <div className="flex gap-2">
          <SegButton onClick={() => generateInvite("一般")} disabled={generating === "一般"}>
            保護者用リンク
          </SegButton>
          <SegButton onClick={() => generateInvite("指導者")} disabled={generating === "指導者"}>
            指導者用リンク
          </SegButton>
        </div>
      </Card>

      {visibleInvites.length > 0 && (
        <Card>
          {visibleInvites.map((inv) => (
            <div key={inv.id} className="mb-3 last:mb-0">
              <div className="text-xs font-bold">{inv.role === "一般" ? "保護者用" : "指導者用"}</div>
              <div className="flex items-center gap-2 mt-1">
                <input readOnly className={inputClass("text-[11px]")} value={`${origin}/invite/${inv.token}`} />
                <button
                  type="button"
                  onClick={() => copyInviteUrl(inv.token)}
                  className="flex-none text-orange font-bold text-xs"
                >
                  コピー
                </button>
              </div>
              <div className="text-[10.5px] text-ink-soft mt-1">
                有効期限: {formatDateLabel(inv.expires_at.slice(0, 10))}まで(このリンクは複数人が登録に使えます)
              </div>
            </div>
          ))}
        </Card>
      )}

      <SectionLabel>メンバー</SectionLabel>
      <div className="text-xs text-ink-soft mb-2.5">
        ※新規登録者は自動的に「一般」権限で登録されます。ここで権限を変更してください。
      </div>
      <Card>
        {loading ? (
          <EmptyState>読み込み中…</EmptyState>
        ) : (
          profiles.map((u) => (
            <div key={u.id}>
              <div
                className="flex items-center gap-2.5 py-2.5 border-b border-line last:border-b-0 cursor-pointer"
                onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
              >
                <div className="flex-1">
                  <div className="font-bold text-[13.5px]">
                    {u.name}
                    {u.id === userId ? "(自分)" : ""}
                  </div>
                  <div className="text-[11px] text-ink-soft mt-0.5">{u.status}</div>
                </div>
                <select
                  className="w-auto px-2 py-1.5 text-xs border border-line rounded-[10px] bg-white"
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
                  <FieldLabel>表示名</FieldLabel>
                  <div className="flex items-center gap-2 mb-2.5">
                    <input
                      className={inputClass("flex-1")}
                      value={nameDrafts[u.id] ?? u.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setNameDrafts((m) => ({ ...m, [u.id]: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNameChange(u.id, nameDrafts[u.id] ?? u.name);
                      }}
                      className="flex-none px-3 py-2 rounded-[10px] text-[12.5px] font-bold border border-line bg-paper text-ink-soft"
                    >
                      保存
                    </button>
                  </div>

                  {u.email && (
                    <>
                      <FieldLabel>メールアドレス</FieldLabel>
                      <div className="text-[12.5px] text-ink mb-2.5">{u.email}</div>
                    </>
                  )}

                  <FieldLabel>紐付ける選手</FieldLabel>
                  {players.length === 0 ? (
                    <div className="text-xs text-ink-soft mb-2.5">在籍中の選手がいません</div>
                  ) : (
                    <div className="flex gap-1.5 flex-wrap mb-2.5">
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
                            className={`flex-none px-3 py-1.5 rounded-[10px] text-[11px] font-bold border ${
                              linked
                                ? "bg-orange text-white border-orange"
                                : "bg-paper text-ink-soft border-line"
                            }`}
                          >
                            {playerFullName(p)}
                          </button>
                        );
                      })}
                    </div>
                  )}

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

                  {u.role === "管理者" ? (
                    <div className="text-xs text-ink-soft">
                      管理者ユーザーは削除できません。削除するには先に権限を変更してください。
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDelete(u.id)}
                      className="w-full text-center py-2 rounded-[10px] font-bold text-[12.5px] border bg-white"
                      style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                    >
                      {deleteConfirmId === u.id ? "もう一度タップで削除確定" : "このユーザーを削除する"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </Card>
    </PageShell>
  );
}
