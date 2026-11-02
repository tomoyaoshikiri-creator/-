"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { EmptyState, cardClass } from "@/components/ui/Card";
import { canManageAccounting } from "@/lib/permissions";
import { hasAccountingAccess } from "@/lib/plan";
import { formatYen } from "@/lib/accounting";
import { duesPeriodLabel } from "@/lib/accountingDues";
import { fiscalYearOf, playerFullName, todayDateStr } from "@/lib/format";
import type {
  AccountingDuesBillingPeriod,
  AccountingDuesCharge,
  AccountingDuesItem,
  RosterPlayer,
} from "@/lib/database.types";

const MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const CURRENT_YEAR = fiscalYearOf(todayDateStr());

type PlayerRow = { id: string; name: string; player: RosterPlayer | null };
type ChargeCell = {
  item: AccountingDuesItem;
  period: AccountingDuesBillingPeriod;
  charges: AccountingDuesCharge[];
};

function monthOf(date: string) {
  return Number(date.slice(5, 7));
}

export default function AccountingDuesManagementPage() {
  const router = useRouter();
  const { userId, role, plan } = useSession();
  const toast = useToast();

  useEffect(() => {
    if (!canManageAccounting(role) || !hasAccountingAccess(plan)) router.replace("/accounting");
  }, [role, plan, router]);

  const [year, setYear] = useState(CURRENT_YEAR);
  const [items, setItems] = useState<AccountingDuesItem[]>([]);
  const [periods, setPeriods] = useState<AccountingDuesBillingPeriod[]>([]);
  const [charges, setCharges] = useState<AccountingDuesCharge[]>([]);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ itemId: string; periodId: string } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: itemRows, error: itemError }, { data: periodRows, error: periodError }, { data: players, error: playerError }] = await Promise.all([
      supabase.from("accounting_dues_items").select("*").order("position", { ascending: true }),
      supabase.from("accounting_dues_billing_periods").select("*").eq("fiscal_year", year).order("period_start", { ascending: true }),
      supabase.rpc("list_roster_players"),
    ]);
    if (itemError || periodError || playerError) {
      toast.error("集金データを読み込めませんでした");
      setLoading(false);
      return;
    }
    const validItems = itemRows ?? [];
    const validPeriods = (periodRows ?? []).filter(p => validItems.some(i => i.id === p.dues_item_id));
    const periodIds = validPeriods.map(p => p.id);
    let chargeRows: AccountingDuesCharge[] = [];
    if (periodIds.length) {
      const { data, error } = await supabase.from("accounting_dues_charges").select("*").in("billing_period_id", periodIds);
      if (error) {
        toast.error("入金状況を読み込めませんでした");
        setLoading(false);
        return;
      }
      chargeRows = data ?? [];
    }
    setItems(validItems);
    setPeriods(validPeriods);
    setCharges(chargeRows);
    setRoster(players ?? []);
    setLoading(false);
  }, [year, toast]);

  useEffect(() => { void load(); }, [load]);

  const playerRows = useMemo<PlayerRow[]>(() => {
    const rows = roster.map(player => ({ id: player.id, name: playerFullName(player), player }));
    const known = new Set(rows.map(p => p.id));
    for (const charge of charges) {
      if (!known.has(charge.player_id)) {
        known.add(charge.player_id);
        rows.push({ id: charge.player_id, name: "在籍一覧にない選手", player: null });
      }
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }, [roster, charges]);

  const periodById = useMemo(() => new Map(periods.map(p => [p.id, p])), [periods]);
  const itemById = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  const countsFor = useCallback((playerId: string) => {
    const own = charges.filter(c => c.player_id === playerId);
    return {
      unpaid: own.filter(c => c.status !== "paid").length,
      paid: own.filter(c => c.status === "paid").length,
      total: own.length,
    };
  }, [charges]);

  const selectedPlayer = playerRows.find(p => p.id === selectedPlayerId);
  const playerCharges = charges.filter(c => c.player_id === selectedPlayerId);
  const playerCells = useMemo(() => {
    const result: ChargeCell[] = [];
    for (const period of periods) {
      const item = itemById.get(period.dues_item_id);
      if (!item) continue;
      const own = playerCharges.filter(c => c.billing_period_id === period.id);
      if (own.length) result.push({ item, period, charges: own });
    }
    return result;
    // selectedPlayerId and charges trigger recomputation through playerCharges
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods, itemById, charges, selectedPlayerId]);

  const activeItems = items.filter(i => playerCells.some(c => c.item.id === i.id) || i.active);
  const detailCell = selectedCell
    ? playerCells.find(c => c.item.id === selectedCell.itemId && c.period.id === selectedCell.periodId)
    : undefined;

  async function changeStatus(cell: ChargeCell) {
    if (updating) return;
    const groupKeys = new Set(cell.charges.map(c => c.group_key));
    // 世帯単位の請求は、同じ期間・世帯の全選手を同時に更新する。
    const target = charges.filter(c => c.billing_period_id === cell.period.id && groupKeys.has(c.group_key));
    const allPaid = target.every(c => c.status === "paid");
    const next = allPaid ? "unpaid" : "paid";
    setUpdating(true);
    const now = new Date().toISOString();
    const { error } = await createClient().from("accounting_dues_charges").update({
      status: next,
      paid_at: next === "paid" ? now : null,
      paid_by: next === "paid" ? userId : null,
    }).in("id", target.map(c => c.id));
    setUpdating(false);
    if (error) {
      toast.error(`更新に失敗しました: ${error.message}`);
      return;
    }
    setCharges(prev => prev.map(c => target.some(t => t.id === c.id)
      ? { ...c, status: next, paid_at: next === "paid" ? now : null, paid_by: next === "paid" ? userId : null }
      : c));
    toast.success(next === "paid" ? "入金済みにしました" : "未入金に戻しました");
  }

  const filteredPlayers = playerRows.filter(p => {
    const counts = countsFor(p.id);
    if (filter === "unpaid" && counts.unpaid === 0) return false;
    if (filter === "paid" && (counts.total === 0 || counts.unpaid > 0)) return false;
    return p.name.includes(query.trim());
  });
  const unpaidPlayers = playerRows.filter(p => countsFor(p.id).unpaid > 0).length;
  const unpaidAmount = charges.filter(c => c.status !== "paid").reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <PageShell header={<AppHeader title="集金管理" variant="detail" backHref="/accounting" accessBadge="operations" />}>
      {loading ? <EmptyState>読み込み中…</EmptyState> : (
        <>
          <div className="flex items-center justify-between gap-2 mb-3">
            {selectedPlayer ? (
              <button type="button" onClick={() => { setSelectedPlayerId(null); setSelectedCell(null); }}
                className="text-[13px] font-bold text-blue-600 py-1.5">← 選手一覧へ</button>
            ) : <div className="font-bold text-[15px]">選手一覧</div>}
            <select aria-label="対象年度" value={year} onChange={e => { setYear(Number(e.target.value)); setSelectedCell(null); }}
              className="rounded-lg border border-line bg-paper text-ink text-[12px] px-2 py-2">
              {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => <option key={y} value={y}>{y}年度</option>)}
            </select>
          </div>

          {!selectedPlayer ? (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className={cardClass}>
                  <div className="text-[11px] text-ink-soft">未入金のある選手</div>
                  <div className="text-[22px] font-bold mt-1">{unpaidPlayers}<span className="text-[12px] ml-1">名</span></div>
                </div>
                <div className={cardClass}>
                  <div className="text-[11px] text-ink-soft">未入金総額</div>
                  <div className="text-[19px] font-bold mt-1">{formatYen(unpaidAmount)}</div>
                </div>
              </div>
              <input aria-label="選手を検索" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="選手名で検索" className="w-full rounded-xl border border-line bg-paper text-ink text-[13px] px-3 py-2.5 mb-2" />
              <div className="flex gap-2 mb-3">
                {([["all", "すべて"], ["unpaid", "未入金あり"], ["paid", "入金済み"]] as const).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setFilter(key)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-bold border ${filter === key ? "bg-blue-600 text-white border-blue-600" : "bg-paper text-ink-soft border-line"}`}>{label}</button>
                ))}
              </div>
              {filteredPlayers.length === 0 ? <EmptyState>該当する選手がいません</EmptyState> : (
                <div className={cardClass}>
                  {filteredPlayers.map(p => {
                    const count = countsFor(p.id);
                    return (
                      <button key={p.id} type="button" onClick={() => { setSelectedPlayerId(p.id); setSelectedCell(null); }}
                        className="w-full flex items-center justify-between gap-3 text-left py-3 border-b border-line last:border-b-0">
                        <div className="min-w-0">
                          <div className="text-[14px] font-bold truncate">{p.name}</div>
                          <div className="text-[11px] text-ink-soft mt-1">{count.total === 0 ? "請求なし" : `請求 ${count.total}件・入金済み ${count.paid}件`}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${count.unpaid ? "bg-orange/10 text-orange-text" : count.total ? "bg-green/10 text-green-text" : "bg-line text-ink-soft"}`}>
                            {count.unpaid ? `未 ${count.unpaid}件` : count.total ? "すべて済" : "－"}
                          </span>
                          <span className="text-ink-soft">›</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-3">
                <div className="font-bold text-[17px]">{selectedPlayer.name}</div>
                <div className="text-[11px] text-ink-soft mt-1">集金項目 × 集金月。マスをタップすると請求内容を確認できます。</div>
              </div>
              <div className="flex gap-3 text-[11px] text-ink-soft mb-2">
                <span> <strong className="text-green-text">済</strong> 入金済み</span>
                <span> <strong className="text-orange-text">未</strong> 未入金</span>
                <span>－ 集金対象外</span>
              </div>
              <div className={cardClass}>
                <div className="overflow-x-auto" role="region" aria-label="月別集金状況表" tabIndex={0}>
                  <table className="border-collapse text-[12px] min-w-[730px] w-full">
                    <thead>
                      <tr>
                        <th scope="col" className="sticky left-0 z-10 bg-paper text-left px-2 py-2 border-b border-line min-w-[115px]">集金項目</th>
                        {MONTHS.map(m => <th key={m} scope="col" className="text-center px-1 py-2 border-b border-line min-w-[46px]">{m}月</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {activeItems.map(item => (
                        <tr key={item.id}>
                          <th scope="row" className="sticky left-0 z-10 bg-paper text-left font-bold px-2 py-3 border-b border-line">{item.name}</th>
                          {MONTHS.map(m => {
                            const cells = playerCells.filter(c => c.item.id === item.id && monthOf(c.period.periodStart) === m);
                            const isPaid = cells.length > 0 && cells.every(c => c.charges.every(ch => ch.status === "paid"));
                            return <td key={m} className="text-center px-1 py-2 border-b border-line">
                              {cells.length ? (
                                <button type="button" onClick={() => setSelectedCell({ itemId: item.id, periodId: cells[0].period.id })}
                                  aria-label={`${item.name} ${m}月 ${isPaid ? "入金済み" : "未入金"}`}
                                  className={`w-9 h-9 rounded-lg font-bold ${isPaid ? "bg-green/10 text-green-text" : "bg-orange/10 text-orange-text"} ${selectedCell?.periodId === cells[0].period.id ? "ring-2 ring-blue-600" : ""}`}>
                                  {isPaid ? "済" : "未"}
                                </button>
                              ) : <span className="text-ink-soft">－</span>}
                            </td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {activeItems.length === 0 && <EmptyState>集金項目がありません</EmptyState>}
              </div>
              <div className="text-[11px] text-ink-soft mt-2 mb-3">※ 集金月は既存の請求期間の開始月で表示しています。未作成の請求は「－」になります。</div>
              {detailCell && (
                <div className={cardClass}>
                  <div className="flex justify-between gap-2">
                    <div className="font-bold text-[15px]">{detailCell.item.name}・{monthOf(detailCell.period.periodStart)}月</div>
                    <button type="button" onClick={() => setSelectedCell(null)} aria-label="閉じる" className="text-ink-soft px-2">×</button>
                  </div>
                  <div className="text-[11px] text-ink-soft mt-1">{duesPeriodLabel({ periodStart: detailCell.period.period_start, periodEnd: detailCell.period.period_end })}</div>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-[12px] text-ink-soft">請求額</span>
                    <strong className="text-[17px]">{formatYen(detailCell.charges.reduce((s, c) => s + Number(c.amount), 0))}</strong>
                  </div>
                  <div className="text-[11px] text-ink-soft mt-2">入金状況</div>
                  <button type="button" disabled={updating} onClick={() => void changeStatus(detailCell)}
                    className={`w-full mt-2 py-2.5 rounded-lg border font-bold text-[13px] disabled:opacity-50 ${detailCell.charges.every(c => c.status === "paid") ? "border-green text-green-text bg-green/10" : "border-orange text-orange-text bg-orange/10"}`}>
                    {updating ? "更新中…" : detailCell.charges.every(c => c.status === "paid") ? "済（タップで未に戻す）" : "未（タップで済にする）"}
                  </button>
                  {detailCell.item.billing_unit === "household" && <div className="text-[11px] text-ink-soft mt-2">世帯単位の請求は同じ世帯の選手もまとめて更新します。</div>}
                  <div className="text-[11px] text-ink-soft mt-2">請求額の編集は、料金計算方式の切り替えと合わせて次段階で対応します。</div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
