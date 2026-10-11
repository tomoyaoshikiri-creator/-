"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { Fab, Modal } from "@/components/ui/Modal";
import { FieldLabel, SegButton, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { InlineSelect } from "@/components/ui/InlineSelect";
import { canManageAccounting } from "@/lib/permissions";
import { hasAccountingAccess } from "@/lib/plan";
import { ACCOUNTING_KIND_LABELS, formatYen, type AccountingKind } from "@/lib/accounting";
import { fiscalYearLabel, fiscalYearOf, formatFullDateLabel, todayDateStr } from "@/lib/format";
import type { AccountingCategory, AccountingTransaction } from "@/lib/database.types";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());
const FISCAL_YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_FISCAL_YEAR - 2 + i);

interface Draft {
  transaction_date: string;
  kind: AccountingKind;
  category_id: string;
  payee: string;
  amount: string;
  note: string;
}

function emptyDraft(): Draft {
  return { transaction_date: todayDateStr(), kind: "expense", category_id: "", payee: "", amount: "", note: "" };
}

export default function AccountingTransactionsPage() {
  const router = useRouter();
  const { role, plan, teamId } = useSession();
  const toast = useToast();

  useEffect(() => {
    if (!canManageAccounting(role) || !hasAccountingAccess(plan)) router.replace("/accounting");
  }, [role, plan, router]);

  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [kindFilter, setKindFilter] = useState<AccountingKind | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [categories, setCategories] = useState<AccountingCategory[]>([]);
  const [transactions, setTransactions] = useState<AccountingTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: cats }, { data: txs }] = await Promise.all([
      supabase.from("accounting_categories").select("*").order("position", { ascending: true }),
      supabase
        .from("accounting_transactions")
        .select("*")
        .eq("fiscal_year", fiscalYear)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    setCategories(cats ?? []);
    setTransactions(txs ?? []);
    setLoading(false);
  }, [fiscalYear]);

  useEffect(() => {
    load();
  }, [load]);

  const categoryById = (id: string) => categories.find((c) => c.id === id);

  const filtered = transactions.filter((t) => {
    const cat = categoryById(t.category_id);
    if (!cat) return false;
    if (kindFilter !== "all" && cat.kind !== kindFilter) return false;
    if (categoryFilter !== "all" && t.category_id !== categoryFilter) return false;
    return true;
  });
  const total = filtered.reduce((sum, t) => sum + Number(t.amount), 0);

  const categoryOptions = categories
    .filter((c) => !c.auto_managed && (kindFilter === "all" || c.kind === kindFilter))
    .map((c) => ({ value: c.id, label: c.name }));

  // 新規登録
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  function openModal() {
    setDraft(emptyDraft());
    setModalOpen(true);
  }

  async function handleCreate() {
    const amount = Number(draft.amount);
    if (!draft.category_id || !draft.payee.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast("項目・支払先・金額を正しく入力してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("accounting_transactions")
      .insert({
        team_id: teamId,
        fiscal_year: fiscalYearOf(draft.transaction_date),
        category_id: draft.category_id,
        transaction_date: draft.transaction_date,
        payee: draft.payee.trim(),
        amount,
        note: draft.note.trim() || null,
      })
      .select("*")
      .single();
    setSaving(false);
    if (error || !data) {
      toast(`保存に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    setModalOpen(false);
    if (data.fiscal_year === fiscalYear) {
      setTransactions((prev) => [data, ...prev]);
    }
    toast("記録を保存しました");
  }

  // 一覧の各行の編集・削除
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function openRow(t: AccountingTransaction) {
    if (expandedId === t.id) {
      setExpandedId(null);
      setEditDraft(null);
      return;
    }
    const cat = categoryById(t.category_id);
    setExpandedId(t.id);
    setEditDraft({
      transaction_date: t.transaction_date,
      kind: cat?.kind ?? "expense",
      category_id: t.category_id,
      payee: t.payee,
      amount: String(t.amount),
      note: t.note ?? "",
    });
  }

  async function handleSaveEdit(id: string) {
    if (!editDraft) return;
    const amount = Number(editDraft.amount);
    if (!editDraft.category_id || !editDraft.payee.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast("項目・支払先・金額を正しく入力してください");
      return;
    }
    setEditSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("accounting_transactions")
      .update({
        category_id: editDraft.category_id,
        transaction_date: editDraft.transaction_date,
        payee: editDraft.payee.trim(),
        amount,
        note: editDraft.note.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    setEditSaving(false);
    if (error || !data) {
      toast(`更新に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    setTransactions((prev) => prev.map((t) => (t.id === id ? data : t)));
    setExpandedId(null);
    setEditDraft(null);
    toast("記録を修正しました");
  }

  function handleDeleteClick(id: string) {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    setDeleteConfirmId(null);
    (async () => {
      const supabase = createClient();
      const { error } = await supabase.from("accounting_transactions").delete().eq("id", id);
      if (error) {
        toast(`削除に失敗しました: ${error.message}`);
        return;
      }
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setExpandedId(null);
      toast("記録を削除しました");
    })();
  }

  return (
    <PageShell
      header={<AppHeader title="入出金" variant="list" backHref="/accounting" accessBadge="operations" />}
      fab={
        <>
          <Fab onClick={openModal} label="記録する" />
          <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="入出金を記録">
            <FieldLabel>日付</FieldLabel>
            <input
              type="date"
              className={inputClass()}
              value={draft.transaction_date}
              onChange={(e) => setDraft((d) => ({ ...d, transaction_date: e.target.value }))}
            />
            <div className="mt-2.5">
              <FieldLabel>収入・支出</FieldLabel>
              <div className="flex gap-1.5">
                {(["income", "expense"] as AccountingKind[]).map((k) => (
                  <SegButton
                    key={k}
                    active={draft.kind === k}
                    onClick={() => setDraft((d) => ({ ...d, kind: k, category_id: "" }))}
                  >
                    {ACCOUNTING_KIND_LABELS[k]}
                  </SegButton>
                ))}
              </div>
            </div>
            <div className="mt-2.5">
              <FieldLabel>項目</FieldLabel>
              <select
                className={inputClass()}
                value={draft.category_id}
                onChange={(e) => setDraft((d) => ({ ...d, category_id: e.target.value }))}
              >
                <option value="">選ぶ</option>
                {categories
                  .filter((c) => !c.auto_managed && c.kind === draft.kind)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="mt-2.5">
              <FieldLabel>支払先・内容</FieldLabel>
              <input
                className={inputClass()}
                value={draft.payee}
                onChange={(e) => setDraft((d) => ({ ...d, payee: e.target.value }))}
                placeholder="例: ○○スポーツ用品店"
              />
            </div>
            <div className="mt-2.5">
              <FieldLabel>金額</FieldLabel>
              <input
                type="number"
                min={1}
                className={inputClass()}
                value={draft.amount}
                onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
              />
            </div>
            <div className="mt-2.5">
              <FieldLabel>備考(任意)</FieldLabel>
              <input
                className={inputClass()}
                value={draft.note}
                onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              />
            </div>
            <SubmitButton onClick={handleCreate} disabled={saving}>
              {saving ? "保存中…" : "この内容で保存する"}
            </SubmitButton>
          </Modal>
        </>
      }
    >
      <SectionLabel>年度・絞り込み</SectionLabel>
      <Card>
        <InlineSelect
          value={String(fiscalYear)}
          onChange={(v) => setFiscalYear(Number(v))}
          options={FISCAL_YEAR_OPTIONS.map((y) => ({ value: String(y), label: fiscalYearLabel(y) }))}
        />
        <div className="flex gap-1.5 mt-2.5">
          {(["all", "income", "expense"] as const).map((k) => (
            <SegButton
              key={k}
              active={kindFilter === k}
              onClick={() => {
                setKindFilter(k);
                setCategoryFilter("all");
              }}
            >
              {k === "all" ? "すべて" : ACCOUNTING_KIND_LABELS[k]}
            </SegButton>
          ))}
        </div>
        {categoryOptions.length > 0 && (
          <div className="mt-2.5">
            <InlineSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[{ value: "all", label: "項目: すべて" }, ...categoryOptions]}
            />
          </div>
        )}
      </Card>

      <SectionLabel>
        明細({filtered.length}件、合計 {formatYen(total)})
      </SectionLabel>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState>記録がありません</EmptyState>
        </Card>
      ) : (
        <Card className="max-h-[65vh] overflow-y-auto">
          {filtered.map((t) => {
            const cat = categoryById(t.category_id);
            const expanded = expandedId === t.id;
            return (
              <div key={t.id} className="border-b border-line last:border-b-0">
                <button type="button" onClick={() => openRow(t)} className="w-full text-left py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] text-ink-soft">{formatFullDateLabel(t.transaction_date)}</div>
                      <div className="font-bold text-[13px] truncate">
                        {cat?.name ?? "(削除済みの項目)"} ・ {t.payee}
                      </div>
                      {t.note && <div className="text-[11px] text-ink-soft mt-0.5">{t.note}</div>}
                    </div>
                    <div
                      className="flex-none font-mono font-bold text-[13px]"
                      style={{ color: cat?.kind === "income" ? "var(--green)" : "var(--danger)" }}
                    >
                      {cat?.kind === "income" ? "+" : "-"}
                      {formatYen(Number(t.amount))}
                    </div>
                  </div>
                </button>
                {expanded && editDraft && (
                  <div className="pb-3">
                    <FieldLabel>日付</FieldLabel>
                    <input
                      type="date"
                      className={inputClass()}
                      value={editDraft.transaction_date}
                      onChange={(e) => setEditDraft((d) => d && { ...d, transaction_date: e.target.value })}
                    />
                    <div className="mt-2">
                      <FieldLabel>項目</FieldLabel>
                      <select
                        className={inputClass()}
                        value={editDraft.category_id}
                        onChange={(e) => setEditDraft((d) => d && { ...d, category_id: e.target.value })}
                      >
                        {categories
                          .filter((c) => !c.auto_managed && c.kind === editDraft.kind)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="mt-2">
                      <FieldLabel>支払先・内容</FieldLabel>
                      <input
                        className={inputClass()}
                        value={editDraft.payee}
                        onChange={(e) => setEditDraft((d) => d && { ...d, payee: e.target.value })}
                      />
                    </div>
                    <div className="mt-2">
                      <FieldLabel>金額</FieldLabel>
                      <input
                        type="number"
                        min={1}
                        className={inputClass()}
                        value={editDraft.amount}
                        onChange={(e) => setEditDraft((d) => d && { ...d, amount: e.target.value })}
                      />
                    </div>
                    <div className="mt-2">
                      <FieldLabel>備考(任意)</FieldLabel>
                      <input
                        className={inputClass()}
                        value={editDraft.note}
                        onChange={(e) => setEditDraft((d) => d && { ...d, note: e.target.value })}
                      />
                    </div>
                    <SubmitButton onClick={() => handleSaveEdit(t.id)} disabled={editSaving}>
                      {editSaving ? "保存中…" : "保存する"}
                    </SubmitButton>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(t.id)}
                      className="w-full mt-2 text-center py-1.5 rounded-lg font-bold text-[11.5px] border bg-white"
                      style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                    >
                      {deleteConfirmId === t.id ? "もう一度タップで削除確定" : "この記録を削除"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </PageShell>
  );
}
