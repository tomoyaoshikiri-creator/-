"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { EmptyState, SectionLabel, cardClass } from "@/components/ui/Card";
import { canManageAccounting } from "@/lib/permissions";
import { hasAccountingAccess } from "@/lib/plan";
import { FISCAL_GRID_MONTHS, duesGridStatus, sortDuesPlayers } from "@/lib/duesGrid";
import { fiscalYearOf, playerFullName, todayDateStr } from "@/lib/format";
import type { AccountingDuesBillingPeriod, AccountingDuesCharge, AccountingDuesItem, RosterPlayer } from "@/lib/database.types";

const CURRENT_YEAR = fiscalYearOf(todayDateStr());

export default function AccountingDuesPaymentStatusPage() {
  const router = useRouter();
  const { userId, role, plan } = useSession();
  const toast = useToast();
  const [fiscalYear, setFiscalYear] = useState(CURRENT_YEAR);
  const [items, setItems] = useState<AccountingDuesItem[]>([]);
  const [periods, setPeriods] = useState<AccountingDuesBillingPeriod[]>([]);
  const [charges, setCharges] = useState<AccountingDuesCharge[]>([]);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!canManageAccounting(role) || !hasAccountingAccess(plan)) router.replace("/accounting");
  }, [role, plan, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [itemResult, periodResult, rosterResult] = await Promise.all([
      supabase.from("accounting_dues_items").select("*").order("position", { ascending: true }),
      supabase.from("accounting_dues_billing_periods").select("*").eq("fiscal_year", fiscalYear),
      supabase.rpc("list_roster_players"),
    ]);
    if (itemResult.error || periodResult.error || rosterResult.error) {
      toast.error("入金状況の取得に失敗しました");
      setLoading(false);
      return;
    }
    const nextPeriods = periodResult.data ?? [];
    const ids = nextPeriods.map(p => p.id);
    let nextCharges: AccountingDuesCharge[] = [];
    if (ids.length) {
      const result = await supabase.from("accounting_dues_charges").select("*").in("billing_period_id", ids);
      if (result.error) {
        toast.error("請求情報の取得に失敗しました");
        setLoading(false);
        return;
      }
      nextCharges = result.data ?? [];
    }
    setItems(itemResult.data ?? []);
    setPeriods(nextPeriods);
    setRoster(rosterResult.data ?? []);
    setCharges(nextCharges);
    setLoading(false);
  }, [fiscalYear, toast]);

  useEffect(() => { void load(); }, [load]);

  async function toggle(itemId: string, month: number) {
    if (!selectedPlayer || updating || !canManageAccounting(role)) return;
    const periodIds = new Set(periods.filter(p => p.dues_item_id === itemId && Number(p.period_start.slice(5, 7)) === month).map(p => p.id));
    const selected = charges.filter(c => c.player_id === selectedPlayer && periodIds.has(c.billing_period_id));
    if (!selected.length) return;
    const nextStatus = selected.every(c => c.status === "paid") ? "unpaid" : "paid";
    // 同一期間・同一世帯の請求は一緒に変更する。
    const targets = charges.filter(c => selected.some(s => s.billing_period_id === c.billing_period_id && s.group_key === c.group_key));
    const ids = targets.map(c => c.id);
    const key = itemId + ":" + month;
    setUpdating(key);
    const now = new Date().toISOString();
    const { error } = await createClient().from("accounting_dues_charges").update({
      status: nextStatus, paid_at: nextStatus === "paid" ? now : null,
      paid_by: nextStatus === "paid" ? userId : null, updated_at: now,
    }).in("id", ids);
    if (error) toast.error("入金状態を更新できませんでした: " + error.message);
    else setCharges(prev => prev.map(c => ids.includes(c.id)
      ? { ...c, status: nextStatus, paid_at: nextStatus === "paid" ? now : null, paid_by: nextStatus === "paid" ? userId : null, updated_at: now }
      : c));
    setUpdating(null);
  }

  const player = roster.find(p => p.id === selectedPlayer);
  const sortedPlayers = sortDuesPlayers(roster);
  return (
    <PageShell header={<AppHeader title="入金管理" variant="detail" backHref="/accounting" accessBadge="operations" />}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <button type="button" onClick={() => { setFiscalYear(y => y - 1); setSelectedPlayer(null); }} className="px-3 py-2 border border-line rounded-lg text-[12px]">前年度</button>
        <strong className="text-[14px]">{fiscalYear}年度</strong>
        <button type="button" onClick={() => { setFiscalYear(y => y + 1); setSelectedPlayer(null); }} className="px-3 py-2 border border-line rounded-lg text-[12px]">次年度</button>
      </div>
      {loading ? <EmptyState>読み込み中…</EmptyState> : !player ? (
        <>
          <SectionLabel>選手を選択</SectionLabel>
          <div className={cardClass}>
            {sortedPlayers.length === 0 ? <EmptyState>選手が登録されていません</EmptyState> : sortedPlayers.map(p => {
              const playerCharges = charges.filter(c => c.player_id === p.id);
              const unpaid = playerCharges.filter(c => c.status === "unpaid").length;
              return <button key={p.id} type="button" onClick={() => setSelectedPlayer(p.id)}
                className="w-full flex items-center justify-between text-left py-3 border-b border-line last:border-b-0">
                <span className="font-bold text-[13px]">{playerFullName(p)}{p.number ? <span className="text-ink-soft text-[11px] ml-1">#{p.number}</span> : null}</span>
                <span className="text-[12px] text-ink-soft">{unpaid > 0 ? <span className="text-orange-text font-bold">未入金 {unpaid}件</span> : playerCharges.length ? "未入金なし" : "請求なし"}　›</span>
              </button>;
            })}
          </div>
        </>
      ) : (
        <>
          <button type="button" onClick={() => setSelectedPlayer(null)} className="text-blue-600 font-bold text-[12px] mb-3">‹ 選手一覧に戻る</button>
          <SectionLabel>{playerFullName(player)} の年間入金状況</SectionLabel>
          <div className={cardClass}>
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full border-collapse text-[11px]">
                <thead><tr className="border-b border-line">
                  <th className="sticky left-0 z-10 bg-paper text-left min-w-[110px] px-2 py-3">集金項目</th>
                  {FISCAL_GRID_MONTHS.map(month => <th key={month} className="min-w-[42px] px-1 py-3 text-center">{month}月</th>)}
                </tr></thead>
                <tbody>{items.map(item => {
                  const itemPeriods = periods.filter(p => p.dues_item_id === item.id);
                  const itemPeriodIds = new Set(itemPeriods.map(p => p.id));
                  const itemCharges = charges.filter(c => itemPeriodIds.has(c.billing_period_id));
                  return <tr key={item.id} className="border-b border-line last:border-b-0">
                    <th className="sticky left-0 z-10 bg-paper text-left px-2 py-3 font-bold whitespace-nowrap">{item.name}</th>
                    {FISCAL_GRID_MONTHS.map(month => {
                      const status = duesGridStatus(player.id, month, itemPeriods, itemCharges);
                      return <td key={month} className="text-center px-1 py-2">
                        <button type="button" disabled={status === "none" || updating !== null} onClick={() => void toggle(item.id, month)}
                          aria-label={item.name + " " + month + "月 " + (status === "paid" ? "入金済み" : status === "unpaid" ? "未入金" : "請求なし")}
                          className={"min-w-[32px] rounded-md px-1 py-1.5 font-bold disabled:opacity-50 " +
                            (status === "paid" ? "text-green-text bg-green/8" : status === "unpaid" ? "text-orange-text bg-orange/8" : "text-ink-soft")}>
                          {updating === item.id + ":" + month ? "…" : status === "paid" ? "済" : status === "unpaid" ? "未" : "－"}
                        </button>
                      </td>;
                    })}
                  </tr>;
                })}</tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-ink-soft">「済」入金済み／「未」未入金／「－」請求なし。左右にスクロールできます。</p>
          </div>
        </>
      )}
    </PageShell>
  );
}
