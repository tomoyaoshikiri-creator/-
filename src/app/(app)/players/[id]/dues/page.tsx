"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { canManageAccounting } from "@/lib/permissions";
import { hasAccountingAccess } from "@/lib/plan";
import { formatYen } from "@/lib/accounting";
import { duesPeriodLabel } from "@/lib/accountingDues";
import { playerFullName } from "@/lib/format";
import type { AccountingDuesBillingPeriod, AccountingDuesCharge, AccountingDuesItem, Player } from "@/lib/database.types";

interface ItemGroup {
  item: AccountingDuesItem;
  rows: { period: AccountingDuesBillingPeriod; charge: AccountingDuesCharge }[];
}

export default function PlayerDuesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, role, plan } = useSession();

  const [player, setPlayer] = useState<Player | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasAccountingAccess(plan)) router.replace(`/karte/players/${params.id}`);
  }, [plan, params.id, router]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("players").select("*").eq("id", params.id).single();
      setPlayer(data ?? null);
    })();
  }, [params.id]);

  useEffect(() => {
    (async () => {
      if (canManageAccounting(role)) {
        setAuthorized(true);
        return;
      }
      const supabase = createClient();
      const { data: link } = await supabase
        .from("player_guardians")
        .select("id")
        .eq("player_id", params.id)
        .eq("profile_id", userId)
        .maybeSingle();
      if (link) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
        router.replace("/karte/players");
      }
    })();
  }, [role, userId, params.id, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: chargeRows } = await supabase
      .from("accounting_dues_charges")
      .select("*")
      .eq("player_id", params.id);
    const charges = chargeRows ?? [];

    const periodIds = [...new Set(charges.map((c) => c.billing_period_id))];
    const { data: periodRows } =
      periodIds.length > 0
        ? await supabase.from("accounting_dues_billing_periods").select("*").in("id", periodIds)
        : { data: [] };
    const periods = periodRows ?? [];

    const itemIds = [...new Set(periods.map((p) => p.dues_item_id))];
    const { data: itemRows } =
      itemIds.length > 0 ? await supabase.from("accounting_dues_items").select("*").in("id", itemIds) : { data: [] };
    const items = itemRows ?? [];

    const byItem = new Map<string, ItemGroup>();
    for (const charge of charges) {
      const period = periods.find((p) => p.id === charge.billing_period_id);
      if (!period) continue;
      const item = items.find((i) => i.id === period.dues_item_id);
      if (!item) continue;
      const group = byItem.get(item.id) ?? { item, rows: [] };
      group.rows.push({ period, charge });
      byItem.set(item.id, group);
    }
    const result = [...byItem.values()];
    result.forEach((g) => g.rows.sort((a, b) => (a.period.period_start < b.period.period_start ? 1 : -1)));
    setGroups(result);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    if (authorized) load();
  }, [authorized, load]);

  if (!authorized) return null;

  return (
    <PageShell
      header={
        <AppHeader
          title={player ? `${playerFullName(player)} / 集金状況` : "集金状況"}
          variant="detail"
          backHref={`/karte/players/${params.id}`}
        />
      }
    >
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState>まだ請求がありません</EmptyState>
        </Card>
      ) : (
        groups.map((g) => (
          <div key={g.item.id} className="mb-3">
            <SectionLabel>{g.item.name}</SectionLabel>
            <Card>
              {g.rows.map(({ period, charge }, idx) => (
                <div
                  key={charge.id}
                  className={`flex items-center justify-between py-2 ${idx < g.rows.length - 1 ? "border-b border-line" : ""}`}
                >
                  <div className="text-[13px]">
                    {duesPeriodLabel({ periodStart: period.period_start, periodEnd: period.period_end })}
                    <span className="font-mono ml-2">{formatYen(Number(charge.amount))}</span>
                  </div>
                  <span
                    className={`flex-none px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      charge.status === "paid" ? "text-green-text bg-green/8" : "text-danger-text bg-danger/8"
                    }`}
                  >
                    {charge.status === "paid" ? "入金済み" : "未納"}
                  </span>
                </div>
              ))}
            </Card>
          </div>
        ))
      )}
    </PageShell>
  );
}
