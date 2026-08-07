"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { CurrentUserBadge } from "@/components/CurrentUserBadge";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { SegButton, FieldLabel, inputClass } from "@/components/ui/SegButton";
import { canAccessTab } from "@/lib/permissions";
import type { Invite, Profile, Role, UserStatus } from "@/lib/database.types";

const ROLE_OPTIONS: Role[] = ["一般", "役員", "指導者", "管理者"];
const STATUS_OPTIONS: UserStatus[] = ["アクティブ", "休止"];

export default function UsersPage() {
  const router = useRouter();
  const { userId, teamId, role } = useSession();
  const toast = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<"一般" | "指導者" | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: p }, { data: inv }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: true }),
      supabase.from("invites").select("*").order("created_at", { ascending: false }),
    ]);
    setProfiles(p ?? []);
    setInvites(inv ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canAccessTab(role, "users")) router.replace("/schedule");
  }, [role, router]);

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
    const supabase = createClient();
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) {
      toast(error.message);
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

  return (
    <PageShell header={<AppHeader title="ユーザー管理" rightSlot={<CurrentUserBadge />} />}>
      <Link href="/settings">
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[13.5px]">アプリの設定</div>
              <div className="text-xs text-ink-soft mt-0.5">チームの配色をカスタマイズできます</div>
            </div>
            <span className="text-ink-soft">›</span>
          </div>
        </Card>
      </Link>

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

      {invites.length > 0 && (
        <Card>
          {invites.map((inv) => (
            <div key={inv.id} className="mb-3 last:mb-0">
              <div className="text-xs font-bold">
                {inv.role === "一般" ? "保護者用" : "指導者用"}
                {inv.used_at ? "(使用済み)" : ""}
              </div>
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
