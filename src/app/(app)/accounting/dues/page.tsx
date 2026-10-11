"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { Fab, Modal } from "@/components/ui/Modal";
import { FieldLabel, SegButton, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { ChevronRightIcon } from "@/components/icons";
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
import type { AccountingCategory, AccountingDuesItem } from "@/lib/database.types";

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

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: duesItems }, { data: cats }] = await Promise.all([
      supabase.from("accounting_dues_items").select("*").order("position", { ascending: true }),
      supabase.from("accounting_categories").select("*").eq("kind", "income").eq("auto_managed", false).order("position", { ascending: true }),
    ]);
    setItems(duesItems ?? []);
    setIncomeCategories(cats ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      toast("名称・計上先の項目を入力してください");
      return;
    }
    if (draft.pricing_method === "flat" && (!Number.isFinite(flatAmount) || flatAmount <= 0)) {
      toast("月額を正しく入力してください");
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
      toast(`保存に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    setModalOpen(false);
    setItems((prev) => [...prev, data]);
    toast("集金項目を追加しました");
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
                <div className="text-[11px] text-danger mt-1">先に「項目の管理」で収入の項目を追加してください</div>
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
        月謝など、定期的に集金するものを項目として登録します。支払方法・学年帯ごとの金額・選手ごとの個別設定は、項目の詳細画面で行います。
      </div>
      <SectionLabel>集金項目</SectionLabel>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState>まだ集金項目がありません</EmptyState>
        </Card>
      ) : (
        items.map((item) => (
          <Link key={item.id} href={`/accounting/dues/${item.id}`}>
            <Card className="cursor-pointer">
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
            </Card>
          </Link>
        ))
      )}
    </PageShell>
  );
}
