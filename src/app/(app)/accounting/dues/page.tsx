"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { EmptyState, SectionLabel, cardClass } from "@/components/ui/Card";
import { Fab, Modal } from "@/components/ui/Modal";
import { FieldLabel, SegButton, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { ChevronRightIcon } from "@/components/icons";
import { FISCAL_GRID_MONTHS, duesGridStatus, sortDuesPlayers } from "@/lib/duesGrid";
import { fiscalYearOf, todayDateStr, playerFullName } from "@/lib/format";
import { canManageAccounting } from "@/lib/permissions";
import { hasAccountingAccess } from "@/lib/plan";
import {
  DUES_BILLING_UNIT_LABELS,
  DUES_CYCLE_MONTHS_LABELS,
  DUES_CYCLE_MONTHS_OPTIONS,
  DUES_PRICING_METHOD_LABELS,
  type DuesBillingUnit,
  type DuesCycleMonths,
  type DuesPricingMethod,
} from "@/lib/accounting";
import type { AccountingCategory, AccountingDuesItem, AccountingDuesBillingPeriod, AccountingDuesCharge, RosterPlayer } from "@/lib/database.types";

interface Draft {
  name: string;
  pricing_method: DuesPricingMethod;
  flat_monthly_amount: string;
  cycle_months: DuesCycleMonths;
  billing_unit: DuesBillingUnit;
  income_category_id: string;
}

function emptyDraft(): Draft {
  return { name: "", pricing_method: "flat", flat_monthly_amount: "", cycle_months: 1, billing_unit: "player", income_category_id: "" };
}

export default function AccountingDuesPage() {
  const router = useRouter();
  const { role, plan, teamId } = useSession();
  const toast = useToast();

  useEffect(() => {
    if (!canManageAccounting(role) || !hasAccountingAccess(plan)) router.replace("/accounting");
  }, [role, plan, router]);

  const [items, setItems] = useState<AccountingDuesItem[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<AccountingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [periods, setPeriods] = useState<AccountingDuesBillingPeriod[]>([]);
  const [charges, setCharges] = useState<AccountingDuesCharge[]>([]);
  const [fiscalYear, setFiscalYear] = useState(fiscalYearOf(todayDateStr()));
  const [updatingCell, setUpdatingCell] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: duesItems }, { data: cats }, { data: players }, { data: billingPeriods }] = await Promise.all([
      supabase.from("accounting_dues_items").select("*").order("position", { ascending: true }),
      supabase.from("accounting_categories").select("*").eq("kind", "income").eq("auto_managed", false).order("position", { ascending: true }),
      supabase.rpc("list_roster_players"),
      supabase.from("accounting_dues_billing_periods").select("*").eq("fiscal_year", fiscalYear),
    ]);
    setItems(duesItems ?? []);
    setRoster(players ?? []);
    setPeriods(billingPeriods ?? []);
    const ids = (billingPeriods ?? []).map(p => p.id);
    if (ids.length) {
      const { data: rows } = await supabase.from("accounting_dues_charges").select("*").in("billing_period_id", ids);
      setCharges(rows ?? []);
    } else setCharges([]);
    setIncomeCategories(cats ?? []);
    setLoading(false);
  }, [fiscalYear]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleMonth(playerId: string, month: number) {
    if (!canManageAccounting(role)) return;
    const periodIds = periods.filter(p => Number(p.period_start.slice(5, 7)) === month && (!selectedItemId || p.dues_item_id === selectedItemId)).map(p => p.id);
    const playerCharges = charges.filter(c => c.player_id === playerId && periodIds.includes(c.billing_period_id));
    if (!playerCharges.length) return;
    const nextStatus = playerCharges.every(c => c.status === "paid") ? "unpaid" : "paid";
    // 世帯請求の場合は、同じ請求期間・世帯の全選手を同時に更新する。
    const targets = charges.filter(c => playerCharges.some(p => p.billing_period_id === c.billing_period_id && p.group_key === c.group_key));
    const cellKey = `${playerId}-${month}`;
    setUpdatingCell(cellKey);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("認証情報を確認できませんでした");
      setUpdatingCell(null);
      return;
    }
    const now = new Date().toISOString();
    const ids = targets.map(c => c.id);
    const { error } = await supabase.from("accounting_dues_charges")
      .update({ status: nextStatus, paid_at: nextStatus === "paid" ? now : null, paid_by: nextStatus === "paid" ? user.id : null, updated_at: now })
      .in("id", ids);
    if (error) toast.error(`入金状態の更新に失敗しました: ${error.message}`);
    else setCharges(prev => prev.map(c => ids.includes(c.id) ? { ...c, status: nextStatus, paid_at: nextStatus === "paid" ? now : null, paid_by: nextStatus === "paid" ? user.id : null, updated_at: now } : c));
    setUpdatingCell(null);
  }

  const visiblePeriods = selectedItemId ? periods.filter(p => p.dues_item_id === selectedItemId) : periods;
  const visibleCharges = charges.filter(c => visiblePeriods.some(p => p.id === c.billing_period_id));

  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  function openModal() {
    setDraft({ ...emptyDraft(), income_category_id: incomeCategories[0]?.id ?? "" });
    setModalOpen(true);
  }

  async function handleCreate() {
    const flatAmount = Number(draft.flat_monthly_amount);
    if (!draft.name.trim() || !draft.income_category_id) {
      toast.warning("名称・計上先の項目を入力してください");
      return;
    }
    if (draft.pricing_method === "flat" && (!Number.isFinite(flatAmount) || flatAmount <= 0)) {
      toast.warning("月額を正しく入力してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const nextPosition = items.length > 0 ? Math.max(...items.map((i) => i.position)) + 1 : 0;
    const { data, error } = await supabase
      .from("accounting_dues_items")
      .insert({
        team_id: teamId,
        name: draft.name.trim(),
        pricing_method: draft.pricing_method,
        flat_monthly_amount: draft.pricing_method === "flat" ? flatAmount : null,
        cycle_months: draft.cycle_months,
        billing_unit: draft.billing_unit,
        income_category_id: draft.income_category_id,
        position: nextPosition,
      })
      .select("*")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(`保存に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    setModalOpen(false);
    setItems((prev) => [...prev, data]);
    toast.success("集金項目を追加しました");
    router.push(`/accounting/dues/${data.id}`);
  }

  return (
    <PageShell
      header={<AppHeader title="集金" variant="list" backHref="/accounting" accessBadge="operations" />}
      fab={
        <>
          <Fab onClick={openModal} label="追加" />
          <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="集金項目を追加">
            <FieldLabel>名称</FieldLabel>
            <input
              className={inputClass()}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="例: 部費"
            />
            <div className="mt-2.5">
              <FieldLabel>料金の決め方</FieldLabel>
              <div className="flex flex-col gap-1.5">
                {(Object.keys(DUES_PRICING_METHOD_LABELS) as DuesPricingMethod[]).map((m) => (
                  <SegButton key={m} active={draft.pricing_method === m} onClick={() => setDraft((d) => ({ ...d, pricing_method: m }))}>
                    {DUES_PRICING_METHOD_LABELS[m]}
                  </SegButton>
                ))}
              </div>
            </div>
            {draft.pricing_method === "flat" && (
              <div className="mt-2.5">
                <FieldLabel>月額</FieldLabel>
                <input
                  type="number"
                  min={1}
                  className={inputClass()}
                  value={draft.flat_monthly_amount}
                  onChange={(e) => setDraft((d) => ({ ...d, flat_monthly_amount: e.target.value }))}
                />
              </div>
            )}
            {draft.pricing_method !== "flat" && (
              <div className="mt-2.5 text-[11.5px] text-ink-soft">
                {draft.pricing_method === "grade_band" ? "学年帯ごとの月額は、追加後の詳細画面で設定します。" : "選手ごとの月額は、追加後の詳細画面で設定します。"}
              </div>
            )}
            <div className="mt-2.5">
              <FieldLabel>集金の周期</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {DUES_CYCLE_MONTHS_OPTIONS.map((c) => (
                  <SegButton key={c} active={draft.cycle_months === c} onClick={() => setDraft((d) => ({ ...d, cycle_months: c }))}>
                    {DUES_CYCLE_MONTHS_LABELS[c]}
                  </SegButton>
                ))}
              </div>
            </div>
            <div className="mt-2.5">
              <FieldLabel>請求の単位</FieldLabel>
              <div className="flex gap-1.5">
                {(Object.keys(DUES_BILLING_UNIT_LABELS) as DuesBillingUnit[]).map((u) => (
                  <SegButton key={u} active={draft.billing_unit === u} onClick={() => setDraft((d) => ({ ...d, billing_unit: u }))}>
                    {DUES_BILLING_UNIT_LABELS[u]}
                  </SegButton>
                ))}
              </div>
            </div>
            <div className="mt-2.5">
              <FieldLabel>計上先の収入項目</FieldLabel>
              <select
                className={inputClass()}
                value={draft.income_category_id}
                onChange={(e) => setDraft((d) => ({ ...d, income_category_id: e.target.value }))}
              >
                <option value="">選ぶ</option>
                {incomeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {incomeCategories.length === 0 && (
                <div className="text-[11px] text-danger-text mt-1">先に「項目の管理」で収入の項目を追加してください</div>
              )}
            </div>
            <SubmitButton onClick={handleCreate} disabled={saving || incomeCategories.length === 0}>
              {saving ? "保存中…" : "この内容で追加する"}
            </SubmitButton>
          </Modal>
        </>
      }
    >
      <div className="text-[12px] text-ink-soft mb-3">
        集金項目を選択して、選手ごとの入金状況を確認・変更できます。
      </div>
      <SectionLabel>選手別・年間入金一覧</SectionLabel>
      <div className={cardClass}>
        <div className="flex flex-wrap gap-2 mb-3">
          <select aria-label="表示する集金項目" value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-[13px] font-bold">
            <option value="">全項目</option>
            {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button type="button" onClick={() => setFiscalYear(y => y - 1)} className="px-3 py-1 rounded-lg border border-line">前年度</button>
          <strong className="text-[13px]">{fiscalYear}年度</strong>
          <button type="button" onClick={() => setFiscalYear(y => y + 1)} className="px-3 py-1 rounded-lg border border-line">次年度</button>
        </div>
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="border-b border-line">
              <th className="sticky left-0 z-10 bg-paper text-left px-2 py-2 min-w-[132px]">選手</th>
              {FISCAL_GRID_MONTHS.map(m => <th key={m} className="text-center px-1 py-2 min-w-[36px]">{m}月</th>)}
            </tr></thead>
            <tbody>
              {sortDuesPlayers(roster).map(player => (
                <tr key={player.id} className="border-b border-line last:border-b-0">
                  <th className="sticky left-0 z-10 bg-paper text-left px-2 py-2 whitespace-nowrap">{playerFullName(player)}</th>
                  {FISCAL_GRID_MONTHS.map(month => {
                    const status = duesGridStatus(player.id, month, visiblePeriods, visibleCharges);
                    return <td key={month} className="text-center px-1 py-2">
                      <button type="button" disabled={status === "none" || updatingCell !== null} onClick={() => toggleMonth(player.id, month)} aria-label={`${playerFullName(player)} ${month}月の入金状態を変更`} className={status === "paid" ? "text-green-text font-bold px-2 py-1" : status === "unpaid" ? "text-orange-text font-bold px-2 py-1" : "text-ink-soft px-2 py-1"}>
                        {updatingCell === `${player.id}-${month}` ? "…" : status === "paid" ? "済" : status === "unpaid" ? "未" : "－"}
                      </button>
                    </td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-[11px] text-ink-soft mt-2">「済」＝入金済み、「未」＝未入金、「－」＝請求なし。横にスクロールして12か月分を確認できます。全項目表示では同じ月の複数請求をまとめて切り替えます。</div>
      </div>
      <SectionLabel>集金項目・料金設定</SectionLabel>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : items.length === 0 ? (
        <div className={cardClass}>
          <EmptyState>まだ集金項目がありません</EmptyState>
        </div>
      ) : (
        items.map((item) => (
          <div key={item.id} className="mb-2.5">
          <Link href={`/accounting/dues/${item.id}/checklist`}>
            <div className={`${cardClass} cursor-pointer`}>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-bold text-[15px] flex items-center gap-1.5">
                    {item.name}
                    {!item.active && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-line text-ink-soft flex-shrink-0">停止中</span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-ink-soft mt-1">
                    {DUES_PRICING_METHOD_LABELS[item.pricing_method as DuesPricingMethod]} ・{" "}
                    {DUES_CYCLE_MONTHS_LABELS[item.cycle_months as DuesCycleMonths]}
                  </div>
                </div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
              </div>
            </div>
          </Link>
          <Link href={`/accounting/dues/${item.id}`} className="block text-right text-[12px] font-bold text-blue-600 py-1 px-2">料金・集金設定</Link>
          </div>
        ))
      )}
    </PageShell>
  );
}
