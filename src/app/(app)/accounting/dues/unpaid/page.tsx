"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { canManageAccounting } from "@/lib/permissions";
import { hasAccountingAccess } from "@/lib/plan";
import { formatYen, type DuesBillingUnit } from "@/lib/accounting";
import { duesPeriodLabel } from "@/lib/accountingDues";
import { loadProfilesMap } from "@/lib/profiles";
import { playerFullName, todayDateStr } from "@/lib/format";
import type {
  AccountingDuesBillingPeriod,
  AccountingDuesCharge,
  AccountingDuesItem,
  RosterPlayer,
} from "@/lib/database.types";

interface UnpaidGroup {
  itemId: string;
  itemName: string;
  periodId: string;
  periodLabel: string;
  groupKey: string;
  label: string;
  amount: number;
  chargeIds: string[];
  daysOverdue: number;
}

export default function AccountingDuesUnpaidPage() {
  const router = useRouter();
  const { userId, role, plan } = useSession();
  const toast = useToast();

  useEffect(() => {
    if (!canManageAccounting(role) || !hasAccountingAccess(plan)) router.replace("/accounting");
  }, [role, plan, router]);

  const [items, setItems] = useState<AccountingDuesItem[]>([]);
  const [periods, setPeriods] = useState<AccountingDuesBillingPeriod[]>([]);
  const [charges, setCharges] = useState<AccountingDuesCharge[]>([]);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: chargeRows }, { data: players }, profileMap] = await Promise.all([
      supabase.from("accounting_dues_charges").select("*").eq("status", "unpaid"),
      supabase.rpc("list_roster_players"),
      loadProfilesMap(supabase),
    ]);
    setCharges(chargeRows ?? []);
    setRoster(players ?? []);
    setProfiles(profileMap);

    const periodIds = [...new Set((chargeRows ?? []).map((c) => c.billing_period_id))];
    const { data: periodRows } =
      periodIds.length > 0
        ? await supabase.from("accounting_dues_billing_periods").select("*").in("id", periodIds)
        : { data: [] };
    setPeriods(periodRows ?? []);

    const itemIds = [...new Set((periodRows ?? []).map((p) => p.dues_item_id))];
    const { data: itemRows } =
      itemIds.length > 0 ? await supabase.from("accounting_dues_items").select("*").in("id", itemIds) : { data: [] };
    setItems(itemRows ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function nameOfPlayer(playerId: string): string {
    const p = roster.find((r) => r.id === playerId);
    return p ? playerFullName(p) : "(卒団済みなどの選手)";
  }

  const today = todayDateStr();
  function daysOverdue(periodStart: string): number {
    const start = new Date(`${periodStart}T00:00:00Z`).getTime();
    const now = new Date(`${today}T00:00:00Z`).getTime();
    return Math.max(0, Math.round((now - start) / (24 * 60 * 60 * 1000)));
  }

  const groups: UnpaidGroup[] = (() => {
    const byKey = new Map<string, AccountingDuesCharge[]>();
    for (const c of charges) {
      const key = `${c.billing_period_id}:${c.group_key}`;
      const arr = byKey.get(key) ?? [];
      arr.push(c);
      byKey.set(key, arr);
    }
    const result: UnpaidGroup[] = [];
    for (const groupCharges of byKey.values()) {
      const period = periods.find((p) => p.id === groupCharges[0].billing_period_id);
      if (!period) continue;
      const item = items.find((i) => i.id === period.dues_item_id);
      if (!item) continue;
      const playerNames = groupCharges.map((c) => nameOfPlayer(c.player_id)).join("・");
      const billingUnit = item.billing_unit as DuesBillingUnit;
      const label =
        billingUnit === "household" && profiles[groupCharges[0].group_key]
          ? `${profiles[groupCharges[0].group_key]}(${playerNames})`
          : playerNames;
      result.push({
        itemId: item.id,
        itemName: item.name,
        periodId: period.id,
        periodLabel: duesPeriodLabel({ periodStart: period.period_start, periodEnd: period.period_end }),
        groupKey: groupCharges[0].group_key,
        label,
        amount: groupCharges.reduce((sum, c) => sum + Number(c.amount), 0),
        chargeIds: groupCharges.map((c) => c.id),
        daysOverdue: daysOverdue(period.period_start),
      });
    }
    return result.sort((a, b) => b.daysOverdue - a.daysOverdue);
  })();

  const [toggling, setToggling] = useState<string | null>(null);
  async function handleMarkPaid(group: UnpaidGroup) {
    setToggling(group.groupKey + group.periodId);
    const supabase = createClient();
    const { error } = await supabase
      .from("accounting_dues_charges")
      .update({ status: "paid", paid_at: new Date().toISOString(), paid_by: userId })
      .in("id", group.chargeIds);
    setToggling(null);
    if (error) {
      toast.error(`更新に失敗しました: ${error.message}`);
      return;
    }
    setCharges((prev) => prev.filter((c) => !group.chargeIds.includes(c.id)));
    toast.success("入金済みにしました");
  }

  return (
    <PageShell header={<AppHeader title="未納一覧" variant="detail" backHref="/accounting/dues" accessBadge="operations" />}>
      <div className="text-[12px] text-ink-soft mb-3">現在未納のままになっている請求を、集金項目をまたいでまとめて確認できます。</div>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState>未納はありません</EmptyState>
        </Card>
      ) : (
        <>
          <SectionLabel>{`未納 ${groups.length}件`}</SectionLabel>
          {groups.map((g) => (
            <Card key={`${g.periodId}:${g.groupKey}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] text-ink-soft">
                    {g.itemName} ・ {g.periodLabel}
                  </div>
                  <div className="text-[14px] font-bold truncate mt-0.5">{g.label}</div>
                  <div className="text-[11.5px] mt-1">
                    <span className="font-mono font-bold">{formatYen(g.amount)}</span>
                    {g.daysOverdue > 0 && <span className="text-danger-text ml-1.5">{g.daysOverdue}日経過</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleMarkPaid(g)}
                  disabled={toggling === g.groupKey + g.periodId}
                  className="flex-none px-3 py-1.5 rounded-lg text-[11.5px] font-bold border border-line text-ink-soft bg-paper disabled:opacity-50"
                >
                  入金済みにする
                </button>
              </div>
            </Card>
          ))}
        </>
      )}
    </PageShell>
  );
}
