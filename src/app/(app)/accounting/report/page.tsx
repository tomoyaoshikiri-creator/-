"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { SegButton } from "@/components/ui/SegButton";
import { InlineSelect } from "@/components/ui/InlineSelect";
import { canManageAccounting } from "@/lib/permissions";
import { hasAccountingAccess } from "@/lib/plan";
import { ACCOUNTING_OFFICER_ROLE_LABELS, formatYen, type AccountingKind } from "@/lib/accounting";
import { fiscalYearLabel, fiscalYearOf, formatFullDateLabel, todayDateStr } from "@/lib/format";
import type { AccountingBudget, AccountingCategory, AccountingOfficer, AccountingTransaction, TeamMember } from "@/lib/database.types";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());
const FISCAL_YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_FISCAL_YEAR - 2 + i);

type ReportMode = "report" | "budget";

interface Row {
  category: AccountingCategory;
  budgeted: number;
  actual: number;
}

function buildRows(categories: AccountingCategory[], budgets: AccountingBudget[], transactions: AccountingTransaction[], kind: AccountingKind): Row[] {
  return categories
    .filter((c) => c.kind === kind)
    .map((c) => {
      const budgeted = budgets.find((b) => b.category_id === c.id)?.budgeted_amount ?? 0;
      // 前年度繰越金は実際の入出金記録を持たない固定の計上額のため、決算額は予算額と同じにする。
      const actual = c.auto_managed
        ? budgeted
        : transactions.filter((t) => t.category_id === c.id).reduce((sum, t) => sum + Number(t.amount), 0);
      return { category: c, budgeted: Number(budgeted), actual: Number(actual) };
    });
}

function ReportTable({ title, rows, mode }: { title: string; rows: Row[]; mode: ReportMode }) {
  const nonAuto = rows.filter((r) => !r.category.auto_managed);
  const autoRows = rows.filter((r) => r.category.auto_managed);
  const displayRows = mode === "report" ? [...nonAuto, ...autoRows] : nonAuto;
  const budgetTotal = displayRows.reduce((sum, r) => sum + r.budgeted, 0);
  const actualTotal = displayRows.reduce((sum, r) => sum + r.actual, 0);
  return (
    <table className="w-full text-[12px] border-collapse mb-4 print:text-[10.5px]">
      <thead>
        <tr className="border-b-2 border-ink">
          <th className="text-left py-1.5 pr-2">{title}</th>
          <th className="text-right py-1.5 px-2 whitespace-nowrap">予算額</th>
          {mode === "report" && <th className="text-right py-1.5 px-2 whitespace-nowrap">決算額</th>}
          {mode === "report" && <th className="text-right py-1.5 pl-2 whitespace-nowrap">差異</th>}
        </tr>
      </thead>
      <tbody>
        {displayRows.map((r) => (
          <tr key={r.category.id} className="border-b border-line">
            <td className="py-1 pr-2">{r.category.name}</td>
            <td className="text-right py-1 px-2 font-mono whitespace-nowrap">{formatYen(r.budgeted)}</td>
            {mode === "report" && <td className="text-right py-1 px-2 font-mono whitespace-nowrap">{formatYen(r.actual)}</td>}
            {mode === "report" && (
              <td className="text-right py-1 pl-2 font-mono whitespace-nowrap">{formatYen(r.budgeted - r.actual)}</td>
            )}
          </tr>
        ))}
        <tr className="border-t-2 border-ink font-bold">
          <td className="py-1.5 pr-2">合計</td>
          <td className="text-right py-1.5 px-2 font-mono whitespace-nowrap">{formatYen(budgetTotal)}</td>
          {mode === "report" && <td className="text-right py-1.5 px-2 font-mono whitespace-nowrap">{formatYen(actualTotal)}</td>}
          {mode === "report" && (
            <td className="text-right py-1.5 pl-2 font-mono whitespace-nowrap">{formatYen(budgetTotal - actualTotal)}</td>
          )}
        </tr>
      </tbody>
    </table>
  );
}

export default function AccountingReportPage() {
  const router = useRouter();
  const { role, plan, teamName } = useSession();

  useEffect(() => {
    if (!canManageAccounting(role) || !hasAccountingAccess(plan)) router.replace("/accounting");
  }, [role, plan, router]);

  const [mode, setMode] = useState<ReportMode>("report");
  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [categories, setCategories] = useState<AccountingCategory[]>([]);
  const [budgets, setBudgets] = useState<AccountingBudget[]>([]);
  const [transactions, setTransactions] = useState<AccountingTransaction[]>([]);
  const [officers, setOfficers] = useState<AccountingOfficer[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: cats }, { data: bud }, { data: txs }, { data: officerRows }, { data: memberRows }] = await Promise.all([
      supabase.from("accounting_categories").select("*").order("position", { ascending: true }),
      supabase.from("accounting_budgets").select("*").eq("fiscal_year", fiscalYear),
      supabase.from("accounting_transactions").select("*").eq("fiscal_year", fiscalYear),
      supabase.from("accounting_officers").select("*"),
      supabase.rpc("list_team_members"),
    ]);
    setCategories(cats ?? []);
    setBudgets(bud ?? []);
    setTransactions(txs ?? []);
    setOfficers(officerRows ?? []);
    setMembers(memberRows ?? []);
    setLoading(false);
  }, [fiscalYear]);

  useEffect(() => {
    load();
  }, [load]);

  const incomeRows = buildRows(categories, budgets, transactions, "income");
  const expenseRows = buildRows(categories, budgets, transactions, "expense");
  const incomeActualTotal = incomeRows.reduce((sum, r) => sum + r.actual, 0);
  const expenseActualTotal = expenseRows.reduce((sum, r) => sum + r.actual, 0);
  const incomeBudgetTotal = incomeRows.reduce((sum, r) => sum + r.budgeted, 0);
  const expenseBudgetTotal = expenseRows.reduce((sum, r) => sum + r.budgeted, 0);
  const carryOver = incomeActualTotal - expenseActualTotal;

  const officerName = (userId: string) => members.find((m) => m.id === userId)?.name ?? "";
  const tantou = officers.filter((o) => o.officer_role === "担当");
  const kansa = officers.filter((o) => o.officer_role === "監査");

  return (
    <PageShell header={<AppHeader title="会計報告" variant="detail" backHref="/accounting" accessBadge="operations" />}>
      <div className="print:hidden">
        <SectionLabel>出力内容</SectionLabel>
        <Card>
          <div className="flex gap-1.5 mb-2.5">
            <SegButton active={mode === "report"} onClick={() => setMode("report")}>
              会計報告
            </SegButton>
            <SegButton active={mode === "budget"} onClick={() => setMode("budget")}>
              予算案
            </SegButton>
          </div>
          <InlineSelect
            value={String(fiscalYear)}
            onChange={(v) => setFiscalYear(Number(v))}
            options={FISCAL_YEAR_OPTIONS.map((y) => ({ value: String(y), label: fiscalYearLabel(y) }))}
          />
          <button
            type="button"
            onClick={() => window.print()}
            className="w-full mt-2.5 text-center py-2.5 rounded-lg font-bold text-[13px] border border-orange text-orange bg-orange/8"
          >
            印刷・PDF保存する
          </button>
        </Card>
      </div>

      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : (
        <div className="bg-white p-4 print:p-0">
          <div className="text-center mb-5">
            <div className="text-[17px] font-bold">
              {fiscalYearLabel(fiscalYear)} {teamName}
              {mode === "report" ? "会計報告" : "予算案"}
            </div>
            <div className="text-[11px] text-ink-soft mt-1">作成日: {formatFullDateLabel(todayDateStr())}</div>
          </div>

          <ReportTable title="収入" rows={incomeRows} mode={mode} />
          <ReportTable title="支出" rows={expenseRows} mode={mode} />

          {mode === "report" && (
            <div className="border-t-2 border-ink pt-2 mb-5 text-[12.5px] space-y-1 print:text-[11px]">
              <div className="flex justify-between">
                <span>収入決算額合計</span>
                <span className="font-mono font-bold">{formatYen(incomeActualTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>支出決算額合計</span>
                <span className="font-mono font-bold">{formatYen(expenseActualTotal)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>次年度への繰越金計上額</span>
                <span className="font-mono">{formatYen(carryOver)}</span>
              </div>
              {(incomeBudgetTotal > 0 || expenseBudgetTotal > 0) && (
                <div className="text-[10.5px] text-ink-soft pt-1">
                  (予算: 収入{formatYen(incomeBudgetTotal)} / 支出{formatYen(expenseBudgetTotal)})
                </div>
              )}
            </div>
          )}

          {mode === "report" ? (
            <>
              <div className="text-[13px] mb-6">以上の通り、ご報告申し上げます。</div>
              <div className="flex justify-end gap-8 mb-6">
                {(tantou.length > 0 ? tantou : [null, null]).slice(0, 2).map((o, i) => (
                  <div key={o?.id ?? i} className="text-center">
                    <div className="text-[10.5px] text-ink-soft mb-1">{ACCOUNTING_OFFICER_ROLE_LABELS["担当"]}</div>
                    <div className="text-[12.5px] font-bold mb-2">{o ? officerName(o.user_id) : "　"}</div>
                    <div className="w-14 h-14 border border-line rounded-full mx-auto" />
                  </div>
                ))}
              </div>
              <div className="text-[13px] mb-4">
                {fiscalYearLabel(fiscalYear)} {teamName}会計報告の内容に相違がないことを確認いたしました。
              </div>
              <div className="flex justify-end gap-8">
                {(kansa.length > 0 ? kansa : [null]).slice(0, 1).map((o, i) => (
                  <div key={o?.id ?? i} className="text-center">
                    <div className="text-[10.5px] text-ink-soft mb-1">{ACCOUNTING_OFFICER_ROLE_LABELS["監査"]}</div>
                    <div className="text-[12.5px] font-bold mb-2">{o ? officerName(o.user_id) : "　"}</div>
                    <div className="w-14 h-14 border border-line rounded-full mx-auto" />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-[12.5px] mt-6">
              なお、この提案内容は「新年度部員保護者」同意のもと審議したものです。
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
