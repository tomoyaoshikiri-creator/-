"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { cardClass } from "@/components/ui/Card";
import { inputClass } from "@/components/ui/SegButton";
import { FISCAL_MONTHS, sortedCollectionMonths, type DuesJoinLeaveRule } from "@/lib/duesAnnualSchedule";
import { calculateDuesInstallments, type DuesRateBasis } from "@/lib/duesRatePlan";
import { previewPlayerDues } from "@/lib/duesPricingPreview";
import type { DuesPricingMethod } from "@/lib/accounting";

function yen(n: number): string { return `${n.toLocaleString("ja-JP")}円`; }

/** 設計プレビュー。DB保存・請求生成を行わない。 */
export default function AnnualDuesSettingsPreview() {
  const [name, setName] = useState("部費");
  const [basis, setBasis] = useState<DuesRateBasis>("monthly");
  const [amountText, setAmountText] = useState("2500");
  const [pricingMethod, setPricingMethod] = useState<DuesPricingMethod>("flat");
  const [gradeAmount, setGradeAmount] = useState("2000");
  const [playerAmount, setPlayerAmount] = useState("1800");
  const [count, setCount] = useState(4);
  const [months, setMonths] = useState<number[]>([4, 7, 10, 1]);
  const [joinLeaveRule, setJoinLeaveRule] = useState<DuesJoinLeaveRule>("prorated");

  const result = useMemo(() => {
    try {
      if (months.length !== count) throw new Error(`集金月をあと${count - months.length}か月選択してください`);
      return { installments: calculateDuesInstallments({ basis, amount: amountText.trim() === "" ? NaN : Number(amountText), collectionMonths: months }), error: "" };
    } catch (e) {
      return { installments: [], error: e instanceof Error ? e.message : "入力を確認してください" };
    }
  }, [basis, amountText, count, months]);

  const total = result.installments.reduce((sum, x) => sum + x.amount, 0);
  const sample = useMemo(() => {
    if (basis !== "monthly" || months.length !== count) return null;
    try {
      return previewPlayerDues({
        basis, pricingMethod,
        flatAmount: Number(amountText),
        grade: 5,
        gradeBands: [{ grade_min: 4, grade_max: 6, monthly_amount: Number(gradeAmount) }],
        playerSetting: pricingMethod === "per_player"
          ? { monthly_amount: Number(playerAmount), exempt: false, start_date: null, stop_date: null }
          : null,
        collectionMonths: months,
      });
    } catch { return null; }
  }, [basis, pricingMethod, amountText, gradeAmount, playerAmount, months, count]);

  function changeCount(next: number) {
    setCount(next);
    setMonths(previous => {
      const kept = sortedCollectionMonths(previous).slice(0, next);
      const available = FISCAL_MONTHS.filter(m => !kept.includes(m));
      return sortedCollectionMonths([...kept, ...available.slice(0, next - kept.length)]);
    });
  }
  function toggleMonth(month: number) {
    setMonths(previous => previous.includes(month)
      ? previous.filter(m => m !== month)
      : previous.length >= count ? previous : sortedCollectionMonths([...previous, month]));
  }

  return (
    <PageShell header={<AppHeader title="新しい集金設定（プレビュー）" variant="detail" backHref="/accounting/dues" accessBadge="operations" />}>
      <div className="mb-3 rounded-lg border border-line bg-paper px-3 py-2 text-[12px] text-ink-soft">
        設計確認用です。入力内容は保存されず、請求も発生しません。
      </div>
      <div className={cardClass}>
        <label htmlFor="dues-name" className="block text-[12px] font-bold mb-1">集金項目名</label>
        <input id="dues-name" className={inputClass()} value={name} onChange={e => setName(e.target.value)} placeholder="例：部費・年会費" />
        <div className="mt-4 text-[12px] font-bold mb-1.5">料金の基準</div>
        <div className="grid grid-cols-2 gap-2">
          {([["monthly", "月額"], ["yearly", "年額"]] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={basis === value} onClick={() => setBasis(value)}
              className={`rounded-lg border py-2.5 text-[13px] font-bold ${basis === value ? "border-blue-500 bg-blue-500/10 text-blue-700" : "border-line text-ink-soft"}`}>{label}</button>
          ))}
        </div>
        <div className="mt-3 text-[12px] font-bold mb-1.5">料金の決め方</div>
        <div className="grid grid-cols-3 gap-1.5">
          {([["flat", "一律"], ["grade_band", "学年別"], ["per_player", "選手別"]] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={pricingMethod === value} onClick={() => setPricingMethod(value)}
              className={`rounded-lg border py-2 text-[12px] font-bold ${pricingMethod === value ? "border-blue-500 bg-blue-500/10 text-blue-700" : "border-line text-ink-soft"}`}>{label}</button>
          ))}
        </div>
        {pricingMethod === "grade_band" && (
          <div className="mt-3">
            <label htmlFor="dues-grade-amount" className="block text-[12px] font-bold mb-1">学年別の料金例（4〜6年生・月額）</label>
            <input id="dues-grade-amount" type="number" min="1" className={inputClass()} value={gradeAmount} onChange={e => setGradeAmount(e.target.value)} />
            <div className="text-[11px] text-ink-soft mt-1">学年帯を追加・編集する画面は正式統合時に対応します。</div>
          </div>
        )}
        {pricingMethod === "per_player" && (
          <div className="mt-3">
            <label htmlFor="dues-player-amount" className="block text-[12px] font-bold mb-1">選手別の料金例（月額）</label>
            <input id="dues-player-amount" type="number" min="1" className={inputClass()} value={playerAmount} onChange={e => setPlayerAmount(e.target.value)} />
            <div className="text-[11px] text-ink-soft mt-1">実際の選手名簿・免除設定との連携は未実装です。</div>
          </div>
        )}
        {basis === "yearly" && pricingMethod !== "flat" && (
          <div className="mt-2 text-[11px] text-orange-text">年額の学年別・選手別設定は未対応です。</div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="dues-amount" className="block text-[12px] font-bold mb-1">{basis === "monthly" ? "一律月額" : "一律年額"}（円）</label>
            <input id="dues-amount" type="number" min="1" step="1" className={inputClass()} value={amountText} onChange={e => setAmountText(e.target.value)} />
          </div>
          <div>
            <label htmlFor="dues-count" className="block text-[12px] font-bold mb-1">年間の集金回数</label>
            <select id="dues-count" className={inputClass()} value={count} onChange={e => changeCount(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}回</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-line/40 px-3 py-3">
          <div className="text-[11px] text-ink-soft">年間集金予定額</div>
          <div className="text-[20px] font-bold">{result.error ? "—" : yen(total)}</div>
          <div className="text-[11px] text-ink-soft mt-0.5">{basis === "monthly" ? "月額 × 12か月" : "年額を集金回数で分割"}</div>
        </div>
      </div>

      <div className={`${cardClass} mt-3`}>
        <div className="text-[14px] font-bold">集金月</div>
        <div className="text-[11.5px] text-ink-soft mt-1 mb-3">集金する月を{count}か月選択。月額の場合は次の集金月の前月までをまとめて請求します。</div>
        <div className="grid grid-cols-4 gap-2">
          {FISCAL_MONTHS.map(month => {
            const selected = months.includes(month);
            return (
              <button key={month} type="button" aria-pressed={selected} onClick={() => toggleMonth(month)}
                className={`rounded-lg border px-1 py-2.5 text-[13px] font-bold ${selected ? "border-blue-500 bg-blue-500/10 text-blue-700" : "border-line bg-paper text-ink-soft"}`}>
                {month}月 {selected ? "✓" : ""}
              </button>
            );
          })}
        </div>
        <div className="mt-2 text-[12px] text-ink-soft">{months.length} / {count}か月選択中</div>
      </div>

      <div className={`${cardClass} mt-3`}>
        <div className="text-[14px] font-bold mb-2">集金予定の内訳（一律料金）</div>
        {result.error ? <div role="alert" className="text-[12px] text-red-600">{result.error}</div> : (
          <div className="divide-y divide-line">
            {result.installments.map(x => (
              <div key={x.month} className="flex justify-between items-center gap-2 py-2">
                <div>
                  <div className="font-bold text-[13px]">{x.month}月に集金</div>
                  {basis === "monthly" && <div className="text-[11px] text-ink-soft">{x.coveredMonths.map(m => `${m}月`).join("・")}分（{x.coveredMonths.length}か月）</div>}
                </div>
                <div className="font-bold text-[14px]">{yen(x.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {basis === "monthly" && pricingMethod !== "flat" && (
        <div className={`${cardClass} mt-3`}>
          <div className="text-[14px] font-bold mb-1">料金方式別の試算</div>
          <div className="text-[11px] text-ink-soft mb-2">{pricingMethod === "grade_band" ? "5年生の例" : "選手1名の例"}</div>
          <div className="font-bold text-[18px]">{sample ? yen(sample.annualTotal) : "—"} <span className="text-[11px] text-ink-soft">年間</span></div>
          {sample?.installments.map(row => <div key={row.month} className="flex justify-between py-1 text-[12px]"><span>{row.month}月</span><span>{yen(row.amount)}</span></div>)}
        </div>
      )}
      <div className={`${cardClass} mt-3`}>
        <div className="text-[14px] font-bold mb-2">途中加入・退団時の請求</div>
        {([["prorated", "在籍期間に応じて請求"], ["full", "全額を請求"]] as const).map(([value, label]) => (
          <label key={value} className="flex gap-2 items-center py-2 text-[12.5px]">
            <input type="radio" name="join-leave-rule" checked={joinLeaveRule === value} onChange={() => setJoinLeaveRule(value)} />
            <span>{label}</span>
          </label>
        ))}
        <div className="text-[11px] text-ink-soft mt-1">途中加入・退団時の請求配分と確定処理は今後実装します。</div>
      </div>
      <Link href="/accounting/dues" className="block mt-4 text-center text-[12px] font-bold underline">集金項目一覧へ戻る</Link>
    </PageShell>
  );
}
