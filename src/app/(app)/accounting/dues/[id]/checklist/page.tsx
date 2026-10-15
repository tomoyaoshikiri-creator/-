"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { InlineSelect } from "@/components/ui/InlineSelect";
import { canManageAccounting } from "@/lib/permissions";
import { hasAccountingAccess } from "@/lib/plan";
import { formatYen, type DuesBillingUnit } from "@/lib/accounting";
import { duesPeriodLabel } from "@/lib/accountingDues";
import { loadProfilesMap } from "@/lib/profiles";
import { fiscalYearLabel, fiscalYearOf, playerFullName, todayDateStr } from "@/lib/format";
import type { AccountingDuesBillingPeriod, AccountingDuesCharge, AccountingDuesItem, RosterPlayer } from "@/lib/database.types";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());
const FISCAL_YEAR_OPTIONS = Array.from({ length: 3 }, (_, i) => CURRENT_FISCAL_YEAR - 1 + i);

interface ChargeGroup {
  groupKey: string;
  label: string;
  amount: number;
  allPaid: boolean;
  chargeIds: string[];
}

export default function AccountingDuesChecklistPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, role, plan } = useSession();
  const toast = useToast();

  useEffect(() => {
    if (!canManageAccounting(role) || !hasAccountingAccess(plan)) router.replace("/accounting");
  }, [role, plan, router]);

  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [item, setItem] = useState<AccountingDuesItem | null>(null);
  const [periods, setPeriods] = useState<AccountingDuesBillingPeriod[]>([]);
  const [charges, setCharges] = useState<AccountingDuesCharge[]>([]);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: itemRow }, { data: periodRows }, { data: players }, profileMap] = await Promise.all([
      supabase.from("accounting_dues_items").select("*").eq("id", params.id).maybeSingle(),
      supabase
        .from("accounting_dues_billing_periods")
        .select("*")
        .eq("dues_item_id", params.id)
        .eq("fiscal_year", fiscalYear)
        .order("period_start", { ascending: true }),
      supabase.rpc("list_roster_players"),
      loadProfilesMap(supabase),
    ]);
    setItem(itemRow ?? null);
    setPeriods(periodRows ?? []);
    setRoster(players ?? []);
    setProfiles(profileMap);

    const periodIds = (periodRows ?? []).map((p) => p.id);
    if (periodIds.length > 0) {
      const { data: chargeRows } = await supabase.from("accounting_dues_charges").select("*").in("billing_period_id", periodIds);
      setCharges(chargeRows ?? []);
    } else {
      setCharges([]);
    }
    setLoading(false);
  }, [params.id, fiscalYear]);

  useEffect(() => {
    load();
  }, [load]);

  const [generating, setGenerating] = useState(false);
  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch("/api/accounting/dues/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duesItemId: params.id }),
    });
    setGenerating(false);
    if (!res.ok) {
      toast.error("請求の作成に失敗しました");
      return;
    }
    const json = await res.json();
    toast.success(json.periodsCreated > 0 ? `${json.periodsCreated}期間分の請求を作成しました` : "新しく作成する請求はありませんでした");
    load();
  }

  function nameOfPlayer(playerId: string): string {
    const p = roster.find((r) => r.id === playerId);
    return p ? playerFullName(p) : "(卒団済みなどの選手)";
  }

  function groupsForPeriod(periodId: string): ChargeGroup[] {
    const periodCharges = charges.filter((c) => c.billing_period_id === periodId);
    const byGroup = new Map<string, AccountingDuesCharge[]>();
    periodCharges.forEach((c) => {
      const arr = byGroup.get(c.group_key) ?? [];
      arr.push(c);
      byGroup.set(c.group_key, arr);
    });
    const billingUnit = item?.billing_unit as DuesBillingUnit | undefined;
    return [...byGroup.entries()].map(([groupKey, groupCharges]) => {
      const playerNames = groupCharges.map((c) => nameOfPlayer(c.player_id)).join("・");
      const label = billingUnit === "household" && profiles[groupKey] ? `${profiles[groupKey]}(${playerNames})` : playerNames;
      return {
        groupKey,
        label,
        amount: groupCharges.reduce((sum, c) => sum + Number(c.amount), 0),
        allPaid: groupCharges.every((c) => c.status === "paid"),
        chargeIds: groupCharges.map((c) => c.id),
      };
    });
  }

  const [toggling, setToggling] = useState<string | null>(null);
  async function handleToggleGroup(group: ChargeGroup) {
    setToggling(group.groupKey);
    const supabase = createClient();
    const nextStatus = group.allPaid ? "unpaid" : "paid";
    const { error } = await supabase
      .from("accounting_dues_charges")
      .update({
        status: nextStatus,
        paid_at: nextStatus === "paid" ? new Date().toISOString() : null,
        paid_by: nextStatus === "paid" ? userId : null,
      })
      .in("id", group.chargeIds);
    setToggling(null);
    if (error) {
      toast.error(`更新に失敗しました: ${error.message}`);
      return;
    }
    setCharges((prev) =>
      prev.map((c) =>
        group.chargeIds.includes(c.id)
          ? { ...c, status: nextStatus, paid_at: nextStatus === "paid" ? new Date().toISOString() : null, paid_by: nextStatus === "paid" ? userId : null }
          : c,
      ),
    );
  }

  const [bulkChecking, setBulkChecking] = useState<string | null>(null);
  async function handleBulkCheck(periodId: string) {
    setBulkChecking(periodId);
    const supabase = createClient();
    const unpaidIds = charges.filter((c) => c.billing_period_id === periodId && c.status === "unpaid").map((c) => c.id);
    if (unpaidIds.length === 0) {
      setBulkChecking(null);
      return;
    }
    const { error } = await supabase
      .from("accounting_dues_charges")
      .update({ status: "paid", paid_at: new Date().toISOString(), paid_by: userId })
      .in("id", unpaidIds);
    setBulkChecking(null);
    if (error) {
      toast.error(`更新に失敗しました: ${error.message}`);
      return;
    }
    toast.success(`${unpaidIds.length}件を入金済みにしました`);
    load();
  }

  if (loading) {
    return (
      <PageShell header={<AppHeader title="入金チェック" variant="detail" backHref="/accounting/dues" accessBadge="operations" />}>
        <EmptyState>読み込み中…</EmptyState>
      </PageShell>
    );
  }
  if (!item) {
    return (
      <PageShell header={<AppHeader title="入金チェック" variant="detail" backHref="/accounting/dues" accessBadge="operations" />}>
        <Card>
          <EmptyState>この集金項目は見つかりませんでした</EmptyState>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell header={<AppHeader title={`入金チェック: ${item.name}`} variant="detail" backHref={`/accounting/dues/${item.id}`} accessBadge="operations" />}>
      <SectionLabel>年度</SectionLabel>
      <Card>
        <InlineSelect
          value={String(fiscalYear)}
          onChange={(v) => setFiscalYear(Number(v))}
          options={FISCAL_YEAR_OPTIONS.map((y) => ({ value: String(y), label: fiscalYearLabel(y) }))}
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="w-full mt-2.5 text-center py-2 rounded-lg font-bold text-[12px] border border-orange text-orange bg-orange/8 disabled:opacity-50"
        >
          {generating ? "作成中…" : "本日時点の請求を作成する"}
        </button>
        <div className="text-[10.5px] text-ink-soft mt-1.5">
          通常は毎朝自動で作成されます。集金項目を追加した直後など、すぐに確認したいときに使ってください。
        </div>
      </Card>

      {periods.length === 0 ? (
        <Card>
          <EmptyState>まだ請求がありません</EmptyState>
        </Card>
      ) : (
        periods.map((period) => {
          const groups = groupsForPeriod(period.id);
          const unpaidCount = groups.filter((g) => !g.allPaid).length;
          return (
            <div key={period.id} className="mb-3">
              <SectionLabel>{duesPeriodLabel({ periodStart: period.period_start, periodEnd: period.period_end })}</SectionLabel>
              <Card>
                {groups.length === 0 ? (
                  <EmptyState>対象者がいません</EmptyState>
                ) : (
                  <>
                    <ul>
                      {groups.map((g) => (
                        <li key={g.groupKey} className="flex items-center justify-between py-2 border-b border-line last:border-b-0">
                          <div className="min-w-0">
                            <div className="text-[13px] font-bold truncate">{g.label}</div>
                            <div className="text-[11px] text-ink-soft">{formatYen(g.amount)}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleGroup(g)}
                            disabled={toggling === g.groupKey}
                            className={`flex-none px-3 py-1.5 rounded-lg text-[11.5px] font-bold border disabled:opacity-50 ${
                              g.allPaid ? "border-green text-green bg-green/8" : "border-line text-ink-soft bg-paper"
                            }`}
                          >
                            {g.allPaid ? "入金済み" : "未納"}
                          </button>
                        </li>
                      ))}
                    </ul>
                    {unpaidCount > 1 && (
                      <button
                        type="button"
                        onClick={() => handleBulkCheck(period.id)}
                        disabled={bulkChecking === period.id}
                        className="w-full mt-2.5 text-center py-1.5 rounded-lg font-bold text-[11.5px] border border-line bg-paper text-ink-soft disabled:opacity-50"
                      >
                        未納分をまとめて入金済みにする({unpaidCount}件)
                      </button>
                    )}
                  </>
                )}
              </Card>
            </div>
          );
        })
      )}
    </PageShell>
  );
}
