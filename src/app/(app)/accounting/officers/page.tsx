"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { inputClass } from "@/components/ui/SegButton";
import { canManageAccounting } from "@/lib/permissions";
import { hasAccountingAccess } from "@/lib/plan";
import { ACCOUNTING_MAX_OFFICERS, ACCOUNTING_OFFICER_ROLE_LABELS, type AccountingOfficerRole } from "@/lib/accounting";
import type { AccountingOfficer, TeamMember } from "@/lib/database.types";

function OfficerRoleSection({
  officerRole,
  officers,
  members,
  teamId,
  onChanged,
}: {
  officerRole: AccountingOfficerRole;
  officers: AccountingOfficer[];
  members: TeamMember[];
  teamId: string;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);

  const assigned = officers.filter((o) => o.officer_role === officerRole);
  const assignedIds = new Set(officers.map((o) => o.user_id));
  const candidates = members.filter((m) => !assignedIds.has(m.id));
  const nameOf = (userId: string) => members.find((m) => m.id === userId)?.name ?? "不明なユーザー";

  async function handleAdd() {
    if (!selectedId) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("accounting_officers")
      .insert({ team_id: teamId, user_id: selectedId, officer_role: officerRole });
    setSaving(false);
    if (error) {
      toast(`登録に失敗しました: ${error.message}`);
      return;
    }
    setSelectedId("");
    onChanged();
  }

  async function handleRemove(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("accounting_officers").delete().eq("id", id);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    onChanged();
  }

  return (
    <>
      <SectionLabel>
        {ACCOUNTING_OFFICER_ROLE_LABELS[officerRole]}(最大{ACCOUNTING_MAX_OFFICERS[officerRole]}名)
      </SectionLabel>
      <Card>
        {assigned.length === 0 ? (
          <EmptyState>まだ指定されていません</EmptyState>
        ) : (
          <ul>
            {assigned.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2 border-b border-line last:border-b-0">
                <span className="font-bold text-[13px]">{nameOf(o.user_id)}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(o.id)}
                  className="flex-none px-2.5 py-1 rounded-lg text-[11px] font-bold border border-line text-ink-soft bg-paper"
                >
                  解除
                </button>
              </li>
            ))}
          </ul>
        )}
        {candidates.length > 0 && (
          <div className={assigned.length > 0 ? "mt-2.5 flex gap-2" : "flex gap-2"}>
            <select className={inputClass("flex-1")} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">選ぶ</option>
              {candidates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}({m.role})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !selectedId}
              className="flex-none px-3.5 rounded-lg font-bold text-[12.5px] border border-orange text-orange bg-orange/8 disabled:opacity-50"
            >
              追加
            </button>
          </div>
        )}
      </Card>
    </>
  );
}

export default function AccountingOfficersPage() {
  const router = useRouter();
  const { role, plan, teamId } = useSession();

  useEffect(() => {
    if (!canManageAccounting(role) || !hasAccountingAccess(plan)) router.replace("/accounting");
  }, [role, plan, router]);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [officers, setOfficers] = useState<AccountingOfficer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: m }, { data: o }] = await Promise.all([
      supabase.rpc("list_team_members"),
      supabase.from("accounting_officers").select("*"),
    ]);
    setMembers(m ?? []);
    setOfficers(o ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageShell header={<AppHeader title="会計担当・会計監査" variant="detail" backHref="/accounting" accessBadge="operations" />}>
      <div className="text-[12px] text-ink-soft mb-3">
        会計報告書に署名・押印する人を指定します。1人が会計担当・会計監査を兼任することはできません。
      </div>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : (
        <>
          <OfficerRoleSection officerRole="担当" officers={officers} members={members} teamId={teamId} onChanged={load} />
          <OfficerRoleSection officerRole="監査" officers={officers} members={members} teamId={teamId} onChanged={load} />
        </>
      )}
    </PageShell>
  );
}
