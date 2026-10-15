"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { SubmitButton, inputClass } from "@/components/ui/SegButton";
import { InlineSelect } from "@/components/ui/InlineSelect";
import { canManageAccounting } from "@/lib/permissions";
import { hasAccountingAccess } from "@/lib/plan";
import { ACCOUNTING_KIND_LABELS, formatYen, type AccountingKind } from "@/lib/accounting";
import { fiscalYearLabel, fiscalYearOf, todayDateStr } from "@/lib/format";
import type { AccountingCategory } from "@/lib/database.types";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());
const FISCAL_YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_FISCAL_YEAR - 2 + i);

interface Draft {
  budgeted_amount: string;
  note: string;
}

export default function AccountingBudgetPage() {
  const router = useRouter();
  const { role, plan, teamId } = useSession();
  const toast = useToast();

  useEffect(() => {
    if (!canManageAccounting(role) || !hasAccountingAccess(plan)) router.replace("/accounting");
  }, [role, plan, router]);

  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [categories, setCategories] = useState<AccountingCategory[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // デフォルトは読み取り専用、「編集」をタップしたときだけ入力欄を表示する
  // (集金項目の詳細画面と揃えたユーザー指示)。
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: cats }, { data: bud }] = await Promise.all([
      supabase.from("accounting_categories").select("*").order("position", { ascending: true }),
      supabase.from("accounting_budgets").select("*").eq("fiscal_year", fiscalYear),
    ]);
    setCategories(cats ?? []);
    const nextDrafts: Record<string, Draft> = {};
    (cats ?? []).forEach((c) => {
      const existing = (bud ?? []).find((b) => b.category_id === c.id);
      nextDrafts[c.id] = {
        budgeted_amount: existing ? String(existing.budgeted_amount) : "",
        note: existing?.note ?? "",
      };
    });
    setDrafts(nextDrafts);
    setLoading(false);
  }, [fiscalYear]);

  useEffect(() => {
    load();
  }, [load]);

  function updateDraft(categoryId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [categoryId]: { ...prev[categoryId], ...patch } }));
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const rows = categories
      .filter((c) => !c.auto_managed)
      .map((c) => ({
        team_id: teamId,
        fiscal_year: fiscalYear,
        category_id: c.id,
        budgeted_amount: Number(drafts[c.id]?.budgeted_amount || 0),
        note: drafts[c.id]?.note.trim() || null,
      }));
    const { error } = await supabase.from("accounting_budgets").upsert(rows, { onConflict: "team_id,fiscal_year,category_id" });
    setSaving(false);
    if (error) {
      toast.error(`保存に失敗しました: ${error.message}`);
      return;
    }
    toast.success("予算を保存しました");
    setEditing(false);
    load();
  }

  function sectionTotal(kind: AccountingKind): number {
    return categories
      .filter((c) => c.kind === kind && !c.auto_managed)
      .reduce((sum, c) => sum + Number(drafts[c.id]?.budgeted_amount || 0), 0);
  }

  return (
    <PageShell header={<AppHeader title="予算案" variant="detail" backHref="/accounting" accessBadge="operations" />}>
      <SectionLabel>年度</SectionLabel>
      <Card>
        <InlineSelect
          value={String(fiscalYear)}
          onChange={(v) => setFiscalYear(Number(v))}
          options={FISCAL_YEAR_OPTIONS.map((y) => ({ value: String(y), label: fiscalYearLabel(y) }))}
        />
      </Card>

      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : categories.length === 0 ? (
        <EmptyState>まず「項目の管理」から収入・支出の項目を登録してください</EmptyState>
      ) : (
        <>
          {(["income", "expense"] as AccountingKind[]).map((kind) => {
            const list = categories.filter((c) => c.kind === kind && !c.auto_managed);
            if (list.length === 0) return null;
            return (
              <div key={kind}>
                <SectionLabel>
                  {ACCOUNTING_KIND_LABELS[kind]}(合計 {formatYen(sectionTotal(kind))})
                </SectionLabel>
                <Card>
                  {list.map((c, idx) => (
                    <div key={c.id} className={`py-2.5 ${idx > 0 ? "border-t border-line" : ""}`}>
                      <div className="font-bold text-[13px] mb-1.5">{c.name}</div>
                      {editing ? (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min={0}
                            className={inputClass("flex-1")}
                            placeholder="予算額"
                            value={drafts[c.id]?.budgeted_amount ?? ""}
                            onChange={(e) => updateDraft(c.id, { budgeted_amount: e.target.value })}
                          />
                          <input
                            className={inputClass("flex-[1.5]")}
                            placeholder="備考(任意)"
                            value={drafts[c.id]?.note ?? ""}
                            onChange={(e) => updateDraft(c.id, { note: e.target.value })}
                          />
                        </div>
                      ) : (
                        <div className="text-[12.5px]">
                          <span className="font-bold">{formatYen(Number(drafts[c.id]?.budgeted_amount || 0))}</span>
                          {drafts[c.id]?.note && <span className="text-ink-soft ml-2">{drafts[c.id].note}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </Card>
              </div>
            );
          })}
          {editing ? (
            <SubmitButton onClick={handleSave} disabled={saving}>
              {saving ? "保存中…" : "この内容で保存する"}
            </SubmitButton>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="w-full text-center py-2.5 rounded-lg font-bold text-[13px] border border-orange text-orange bg-orange/8"
            >
              予算を編集する
            </button>
          )}
        </>
      )}
    </PageShell>
  );
}
