"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { EmptyState, SectionLabel, cardClass } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { canManageAccounting } from "@/lib/permissions";
import { hasAccountingAccess } from "@/lib/plan";
import { formatYen } from "@/lib/accounting";
import { duesPeriodLabel } from "@/lib/accountingDues";
import { FISCAL_GRID_MONTHS, duesGridStatus, sortDuesPlayers } from "@/lib/duesGrid";
import { fiscalYearOf, playerFullName, todayDateStr } from "@/lib/format";
import type {
  AccountingDuesBillingPeriod,
  AccountingDuesCharge,
  AccountingDuesItem,
  AccountingDuesPlayerSetting,
  RosterPlayer,
} from "@/lib/database.types";

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
  const [playerSettings, setPlayerSettings] = useState<AccountingDuesPlayerSetting[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!canManageAccounting(role) || !hasAccountingAccess(plan)) router.replace("/accounting");
  }, [role, plan, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [itemResult, periodResult, rosterResult, settingResult] = await Promise.all([
      supabase.from("accounting_dues_items").select("*").order("position", { ascending: true }),
      supabase.from("accounting_dues_billing_periods").select("*").eq("fiscal_year", fiscalYear),
      supabase.rpc("list_roster_players"),
      supabase.from("accounting_dues_player_settings").select("*"),
    ]);
    if (itemResult.error || periodResult.error || rosterResult.error || settingResult.error) {
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
    setPlayerSettings(settingResult.data ?? []);
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

  // 「入金チェック」画面(集金項目ごと)と同じ対象外設定・請求の個別取消を、
  // こちら(選手ごと)の画面でも集金項目名をタップして開く操作モーダルから行えるようにする
  // (ユーザー指示: 両画面の構成を揃える)。
  const [operationItemId, setOperationItemId] = useState<string | null>(null);
  const [exemptToggling, setExemptToggling] = useState<string | null>(null);
  const [modalDeleteConfirmId, setModalDeleteConfirmId] = useState<string | null>(null);
  const [modalDeletingId, setModalDeletingId] = useState<string | null>(null);

  function settingFor(itemId: string, playerId: string): AccountingDuesPlayerSetting | null {
    return playerSettings.find(s => s.dues_item_id === itemId && s.player_id === playerId) ?? null;
  }

  async function handleToggleExempt(itemId: string, playerId: string) {
    const existing = settingFor(itemId, playerId);
    const nextExempt = !(existing?.exempt ?? false);
    setExemptToggling(itemId);
    const supabase = createClient();
    if (existing) {
      const { error } = await supabase.from("accounting_dues_player_settings").update({ exempt: nextExempt }).eq("id", existing.id);
      setExemptToggling(null);
      if (error) { toast.error(`更新に失敗しました: ${error.message}`); return; }
      setPlayerSettings(prev => prev.map(s => s.id === existing.id ? { ...s, exempt: nextExempt } : s));
    } else {
      const { data, error } = await supabase
        .from("accounting_dues_player_settings")
        .insert({ dues_item_id: itemId, player_id: playerId, exempt: nextExempt })
        .select("*")
        .single();
      setExemptToggling(null);
      if (error || !data) { toast.error(`更新に失敗しました: ${error?.message ?? ""}`); return; }
      setPlayerSettings(prev => [...prev, data]);
    }
    toast.success(nextExempt ? "対象外に設定しました" : "対象外を解除しました");
  }

  interface PlayerItemChargeGroup { period: AccountingDuesBillingPeriod; groupKey: string; amount: number; allPaid: boolean; chargeIds: string[] }
  function chargeGroupsForPlayerItem(itemId: string, playerId: string): PlayerItemChargeGroup[] {
    return periods
      .filter(p => p.dues_item_id === itemId)
      .map((period): PlayerItemChargeGroup | null => {
        const charge = charges.find(c => c.player_id === playerId && c.billing_period_id === period.id);
        if (!charge) return null;
        const groupCharges = charges.filter(c => c.billing_period_id === period.id && c.group_key === charge.group_key);
        return {
          period,
          groupKey: charge.group_key,
          amount: groupCharges.reduce((sum, c) => sum + Number(c.amount), 0),
          allPaid: groupCharges.every(c => c.status === "paid"),
          chargeIds: groupCharges.map(c => c.id),
        };
      })
      .filter((g): g is PlayerItemChargeGroup => g !== null)
      .sort((a, b) => a.period.period_start.localeCompare(b.period.period_start));
  }

  async function handleDeleteChargeInModal(group: PlayerItemChargeGroup) {
    const key = `${group.period.id}:${group.groupKey}`;
    if (modalDeleteConfirmId !== key) {
      setModalDeleteConfirmId(key);
      setTimeout(() => setModalDeleteConfirmId(cur => (cur === key ? null : cur)), 3000);
      return;
    }
    setModalDeletingId(key);
    const supabase = createClient();
    const { error } = await supabase.from("accounting_dues_charges").delete().in("id", group.chargeIds);
    setModalDeletingId(null);
    if (error) { toast.error(`取り消しに失敗しました: ${error.message}`); return; }
    setCharges(prev => prev.filter(c => !group.chargeIds.includes(c.id)));
    toast.success("この請求を取り消しました");
    setModalDeleteConfirmId(null);
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
              <table className="w-full text-[11px] border-collapse">
                <thead><tr className="border-b border-line">
                  <th className="sticky left-0 bg-paper text-left px-2 py-2 min-w-[110px]">集金項目</th>
                  {FISCAL_GRID_MONTHS.map(month => <th key={month} className="text-center px-1 py-2 min-w-[35px]">{month}月</th>)}
                </tr></thead>
                <tbody>{items.map(item => {
                  const itemPeriods = periods.filter(p => p.dues_item_id === item.id);
                  const itemPeriodIds = new Set(itemPeriods.map(p => p.id));
                  const itemCharges = charges.filter(c => itemPeriodIds.has(c.billing_period_id));
                  return <tr key={item.id} className="border-b border-line last:border-b-0">
                    <th className="sticky left-0 bg-paper text-left px-2 py-2 font-semibold whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setOperationItemId(item.id)}
                        aria-label={`${item.name}の対象外設定・請求の取消を操作`}
                        className="text-left underline decoration-dotted decoration-ink-soft underline-offset-2"
                      >
                        {item.name}
                      </button>
                    </th>
                    {FISCAL_GRID_MONTHS.map(month => {
                      const status = duesGridStatus(player.id, month, itemPeriods, itemCharges);
                      return <td key={month} className="text-center px-1 py-2 font-bold">
                        {status === "none" ? <span className="text-ink-soft">－</span> : (
                          <button type="button" disabled={updating !== null} onClick={() => void toggle(item.id, month)}
                            aria-label={`${item.name} ${month}月 ${status === "paid" ? "入金済み" : "未入金"}。タップして変更`}
                            className={`min-w-[28px] py-1 rounded-md border disabled:opacity-50 ${status === "paid" ? "border-green text-green-text bg-green/8" : "border-orange text-orange-text bg-orange/8"}`}>
                            {updating === item.id + ":" + month ? "…" : status === "paid" ? "済" : "未"}
                          </button>
                        )}
                      </td>;
                    })}
                  </tr>;
                })}</tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-ink-soft">
              「済」は入金済み、「未」は請求済み・未入金、「－」は請求なし。「済」「未」をタップすると入金状態を変更できます。
              集金項目名をタップすると、対象外の設定やその項目の請求の個別取消ができます。
            </p>
          </div>
        </>
      )}

      {operationItemId && player && (() => {
        const item = items.find(i => i.id === operationItemId);
        if (!item) return null;
        const exempt = settingFor(item.id, player.id)?.exempt ?? false;
        const rows = chargeGroupsForPlayerItem(item.id, player.id);
        return (
          <Modal
            open={operationItemId !== null}
            onClose={() => { setOperationItemId(null); setModalDeleteConfirmId(null); }}
            title={`${playerFullName(player)}・${item.name}の操作`}
          >
            <div>
              <button
                type="button"
                onClick={() => handleToggleExempt(item.id, player.id)}
                disabled={exemptToggling !== null}
                className={`w-full text-center py-2 rounded-lg font-bold text-[12.5px] border disabled:opacity-50 ${
                  exempt ? "border-orange text-orange-text bg-orange/8" : "border-line text-ink-soft bg-paper"
                }`}
              >
                {exemptToggling === item.id ? "更新中…" : exempt ? "対象外を解除する" : "この集金項目を対象外に設定する"}
              </button>
              <p className="text-[10.5px] text-ink-soft mt-1.5">
                今後の請求作成に反映されます(学年帯等で元々請求が作られない選手でも、対象外であることを明示できます)。
                既に作成済みの請求は自動的には変わりません。取り消したい場合は下の一覧から個別に取り消してください。
              </p>
            </div>
            <div className="border-t border-line mt-4 pt-3">
              <div className="text-[11px] font-bold text-ink-soft mb-2">この集金項目の請求一覧</div>
              {rows.length === 0 ? (
                <p className="text-[12px] text-ink-soft">請求はありません。</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {rows.map((group) => {
                    const key = `${group.period.id}:${group.groupKey}`;
                    return (
                      <li key={key} className="flex items-center justify-between gap-2 text-[12px]">
                        <span>
                          {duesPeriodLabel({ periodStart: group.period.period_start, periodEnd: group.period.period_end })}
                          <span className={`ml-2 font-bold ${group.allPaid ? "text-green-text" : "text-orange-text"}`}>
                            {group.allPaid ? "済" : "未"}
                          </span>
                          <span className="text-ink-soft ml-1">({formatYen(group.amount)})</span>
                        </span>
                        <button
                          type="button"
                          disabled={modalDeletingId === key}
                          onClick={() => handleDeleteChargeInModal(group)}
                          className="flex-none px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap disabled:opacity-50 bg-white"
                          style={{ color: "var(--danger-text)", borderColor: "var(--danger)" }}
                        >
                          {modalDeletingId === key ? "取消中…" : modalDeleteConfirmId === key ? "もう一度タップで取消確定" : "この請求を取り消す"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Modal>
        );
      })()}
    </PageShell>
  );
}
