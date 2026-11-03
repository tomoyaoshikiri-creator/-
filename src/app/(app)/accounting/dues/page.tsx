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
import { FISCAL_MONTHS, sortedCollectionMonths } from "@/lib/duesAnnualSchedule";
import { calculateDuesInstallments } from "@/lib/duesRatePlan";
import { MIN_GRADE_BY_CATEGORY, GRADUATION_GRADE_BY_CATEGORY } from "@/lib/category";
import { gradeLabel, playerFullName } from "@/lib/format";
import { canManageAccounting } from "@/lib/permissions";
import { hasAccountingAccess } from "@/lib/plan";
import {
  DUES_BILLING_UNIT_LABELS,
  DUES_CYCLE_MONTHS_LABELS,
  DUES_CYCLE_MONTHS_OPTIONS,
  DUES_PRICING_METHOD_LABELS,
  DUES_PAYMENT_METHOD_OPTIONS,
  DUES_PAYMENT_METHOD_LABELS,
  formatYen,
  type DuesPaymentMethod,
  type DuesBillingUnit,
  type DuesCycleMonths,
  type DuesPricingMethod,
} from "@/lib/accounting";
import type { AccountingCategory, AccountingDuesItem, RosterPlayer, TeamCategory } from "@/lib/database.types";

interface Draft {
  name: string;
  pricing_method: DuesPricingMethod;
  flat_monthly_amount: string;
  cycle_months: DuesCycleMonths;
  billing_unit: DuesBillingUnit;
  income_category_id: string;
  rate_basis: "monthly" | "yearly";
  flat_yearly_amount: string;
  collection_months: number[];
  join_leave_rule: "prorated" | "full";
  payment_methods: DuesPaymentMethod[];
  reminder_days_after: string;
}

function emptyDraft(): Draft {
  return { name: "", pricing_method: "flat", flat_monthly_amount: "", cycle_months: 1, billing_unit: "player", income_category_id: "",
    rate_basis: "monthly", flat_yearly_amount: "", collection_months: [4,7,10,1], join_leave_rule: "prorated", payment_methods: [], reminder_days_after: "" };
}

type NewBand = { grade_min: number; grade_max: number; monthly_amount: string };
type NewPlayerSetting = { player_id: string; monthly_amount: string; exempt: boolean; start_date: string; stop_date: string; note: string };
function gradesFor(category: TeamCategory): number[] {
  const min = MIN_GRADE_BY_CATEGORY[category], max = GRADUATION_GRADE_BY_CATEGORY[category];
  if (min === null || max === null) return [];
  return [...(category === "小学生" ? [0] : []), ...Array.from({ length: max-min+1 }, (_,i) => min+i)];
}
export default function AccountingDuesPage() {
  const router = useRouter();
  const { role, plan, teamId, category } = useSession();
  const toast = useToast();

  useEffect(() => {
    if (!canManageAccounting(role) || !hasAccountingAccess(plan)) router.replace("/accounting");
  }, [role, plan, router]);

  const [items, setItems] = useState<AccountingDuesItem[]>([]);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [bands, setBands] = useState<NewBand[]>([]);
  const [bandInput, setBandInput] = useState<NewBand>({ grade_min: 0, grade_max: 0, monthly_amount: "" });
  const [playerSettings, setPlayerSettings] = useState<NewPlayerSetting[]>([]);
  const [newPlayerId, setNewPlayerId] = useState("");
  const [incomeCategories, setIncomeCategories] = useState<AccountingCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: duesItems }, { data: cats }, { data: players }] = await Promise.all([
      supabase.from("accounting_dues_items").select("*").order("position", { ascending: true }),
      supabase.from("accounting_categories").select("*").eq("kind", "income").eq("auto_managed", false).order("position", { ascending: true }),
      supabase.rpc("list_roster_players"),
    ]);
    setItems(duesItems ?? []);
    setRoster(players ?? []);
    setIncomeCategories(cats ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  function openModal() {
    setDraft({ ...emptyDraft(), income_category_id: incomeCategories[0]?.id ?? "" });
    setBands([]);
    setBandInput({ grade_min: gradesFor(category)[0] ?? 0, grade_max: gradesFor(category)[0] ?? 0, monthly_amount: "" });
    setPlayerSettings([]);
    setNewPlayerId("");
    setModalOpen(true);
  }

  async function handleCreate() {
    if (saving) return;
    const amount = Number(draft.rate_basis === "yearly" ? draft.flat_yearly_amount : draft.flat_monthly_amount);
    if (!draft.name.trim() || !draft.income_category_id) { toast.warning("名称・計上先の項目を入力してください"); return; }
    if (!draft.collection_months.length) { toast.warning("集金月を選択してください"); return; }
    if (draft.pricing_method === "flat" && (!Number.isSafeInteger(amount) || amount <= 0)) {
      toast.warning("料金を正しく入力してください"); return;
    }
    if (draft.pricing_method === "grade_band") {
      if (draft.rate_basis !== "monthly" || bands.length === 0) {
        toast.warning("学年帯別料金は月額基準で、1件以上設定してください"); return;
      }
      if (bands.some(b => !Number.isSafeInteger(Number(b.monthly_amount)) || Number(b.monthly_amount) <= 0 ||
        b.grade_min > b.grade_max)) { toast.warning("学年帯の月額・範囲を確認してください"); return; }
      const occupied = new Set<number>();
      for (const band of bands) for (let g=band.grade_min;g<=band.grade_max;g++) {
        if (occupied.has(g)) { toast.warning("学年帯が重複しています"); return; }
        occupied.add(g);
      }
    }
    if (draft.pricing_method === "per_player" && playerSettings.length === 0) {
      toast.warning("選手別料金を1件以上設定してください"); return;
    }
    if (playerSettings.some(p => !p.exempt && p.monthly_amount !== "" &&
      (!Number.isSafeInteger(Number(p.monthly_amount)) || Number(p.monthly_amount) < 0))) {
      toast.warning("選手別料金を確認してください"); return;
    }
    if (draft.pricing_method === "per_player" && playerSettings.some(p => !p.exempt && p.monthly_amount === "")) {
      toast.warning("選手ごとの月額を入力してください"); return;
    }
    if (draft.reminder_days_after !== "" && (!Number.isSafeInteger(Number(draft.reminder_days_after)) || Number(draft.reminder_days_after) < 0)) {
      toast.warning("リマインド日数を確認してください"); return;
    }
    setSaving(true);
    const supabase = createClient();
    const nextPosition = items.length > 0 ? Math.max(...items.map(i => i.position)) + 1 : 0;
    const { data, error } = await supabase.from("accounting_dues_items").insert({
      team_id: teamId, name: draft.name.trim(), pricing_method: draft.pricing_method,
      flat_monthly_amount: draft.pricing_method === "flat" && draft.rate_basis === "monthly" ? amount : null,
      flat_yearly_amount: draft.pricing_method === "flat" && draft.rate_basis === "yearly" ? amount : null,
      schedule_mode: "configured", rate_basis: draft.rate_basis,
      collection_months: sortedCollectionMonths(draft.collection_months), join_leave_rule: draft.join_leave_rule,
      payment_methods: draft.payment_methods, reminder_days_after: draft.reminder_days_after === "" ? null : Number(draft.reminder_days_after),
      cycle_months: draft.cycle_months, billing_unit: draft.billing_unit,
      income_category_id: draft.income_category_id, position: nextPosition,
    }).select("*").single();
    if (error || !data) { setSaving(false); toast.error(`作成に失敗しました: ${error?.message ?? ""}`); return; }
    // 関連テーブルの作成に失敗した場合は項目本体も削除して不完全な作成を残さない。
    const bandRows = bands.map(b => ({ dues_item_id: data.id, grade_min: b.grade_min, grade_max: b.grade_max, monthly_amount: Number(b.monthly_amount) }));
    const playerRows = playerSettings.map(p => ({ dues_item_id: data.id, player_id: p.player_id,
      monthly_amount: p.monthly_amount === "" ? null : Number(p.monthly_amount),
      exempt: p.exempt, start_date: p.start_date || null, stop_date: p.stop_date || null, note: p.note.trim() || null }));
    const bandError = bandRows.length ? (await supabase.from("accounting_dues_grade_bands").insert(bandRows)).error : null;
    const playerError = !bandError && playerRows.length ? (await supabase.from("accounting_dues_player_settings").insert(playerRows)).error : null;
    if (bandError || playerError) {
      const { error: rollbackError } = await supabase.from("accounting_dues_items").delete().eq("id", data.id);
      setSaving(false);
      toast.error(rollbackError ? "関連設定の保存に失敗しました。作成された項目を確認してください" : "関連設定の保存に失敗したため、作成を取り消しました");
      return;
    }
    setSaving(false);
    setModalOpen(false);
    setItems(prev => [...prev, data]);
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
        ここでは集金項目・料金・集金月を設定します。入金状況の確認と変更は「入金管理」から行えます。
      </div>
      <SectionLabel>集金項目の設定</SectionLabel>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : items.length === 0 ? (
        <div className={cardClass}>
          <EmptyState>まだ集金項目がありません</EmptyState>
        </div>
      ) : (
        items.map((item) => (
          <div key={item.id} className="mb-2.5">
          <Link href={`/accounting/dues/${item.id}`}>
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
          </div>
        ))
      )}
    </PageShell>
  );
}
