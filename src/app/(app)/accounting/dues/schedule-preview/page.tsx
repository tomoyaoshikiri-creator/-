"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { cardClass } from "@/components/ui/Card";
import { inputClass } from "@/components/ui/SegButton";
import {
  FISCAL_MONTHS, annualDuesTotal, sortedCollectionMonths, validateAnnualDuesSchedule,
  type AnnualDuesSchedule, type DuesJoinLeaveRule,
} from "@/lib/duesAnnualSchedule";

const INITIAL: AnnualDuesSchedule = {
  amountPerCollection: 2500,
  annualCount: 12,
  collectionMonths: [...FISCAL_MONTHS],
  joinLeaveRule: "prorated",
};

function yen(value: number): string {
  return `${value.toLocaleString("ja-JP")}円`;
}

/**
 * UI検討用プレビュー。DB書込・請求作成は行わない。
 * 本番設定画面への統合は新旧請求生成の安全な分岐実装後に行う。
 */
export default function AnnualDuesSettingsPreview() {
  const [name, setName] = useState("部費");
  const [amountText, setAmountText] = useState("2500");
  const [count, setCount] = useState(12);
  const [months, setMonths] = useState<number[]>([...FISCAL_MONTHS]);
  const [joinLeaveRule, setJoinLeaveRule] = useState<DuesJoinLeaveRule>("prorated");

  const schedule = useMemo<AnnualDuesSchedule>(() => ({
    amountPerCollection: amountText.trim() === "" ? NaN : Number(amountText),
    annualCount: count,
    collectionMonths: months,
    joinLeaveRule,
  }), [amountText, count, months, joinLeaveRule]);

  const errors = useMemo(() => validateAnnualDuesSchedule(schedule), [schedule]);
  const total = errors.length === 0 ? annualDuesTotal(schedule) : null;

  function changeCount(next: number) {
    setCount(next);
    // 選択済みの月をできる限り維持する。減らす場合は年度順の先頭から残す。
    setMonths(previous => {
      const kept = sortedCollectionMonths(previous).slice(0, next);
      if (kept.length === next) return kept;
      const available = FISCAL_MONTHS.filter(month => !kept.includes(month));
      return sortedCollectionMonths([...kept, ...available.slice(0, next - kept.length)]);
    });
  }

  function toggleMonth(month: number) {
    setMonths(previous => {
      if (previous.includes(month)) return previous.filter(m => m !== month);
      if (previous.length >= count) return previous;
      return sortedCollectionMonths([...previous, month]);
    });
  }

  return (
    <PageShell header={<AppHeader title="集金項目の設定プレビュー" variant="detail" backHref="/accounting/dues" accessBadge="operations" />}>
      <div className="mb-3 rounded-lg border border-line bg-paper px-3 py-2 text-[12px] text-ink-soft">
        設計確認用の画面です。設定は保存されず、請求も発生しません。
      </div>
      <div className={cardClass}>
        <label htmlFor="dues-name" className="block text-[12px] font-bold mb-1">集金項目名</label>
        <input id="dues-name" className={inputClass()} value={name} onChange={e => setName(e.target.value)} placeholder="例：部費・年会費" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="dues-amount" className="block text-[12px] font-bold mb-1">1回あたりの集金額</label>
            <div className="relative">
              <input id="dues-amount" type="number" min="1" step="1" className={inputClass()} value={amountText} onChange={e => setAmountText(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="dues-count" className="block text-[12px] font-bold mb-1">年間の集金回数</label>
            <select id="dues-count" className={inputClass()} value={count} onChange={e => changeCount(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}回</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-line/40 px-3 py-3">
          <div className="text-[11px] text-ink-soft">年間の集金予定額</div>
          <div className="text-[20px] font-bold">{total === null ? "—" : yen(total)}</div>
          <div className="text-[11px] text-ink-soft mt-0.5">{amountText || "—"}円 × {count}回</div>
        </div>
      </div>

      <div className={`${cardClass} mt-3`}>
        <div className="text-[14px] font-bold">集金月</div>
        <div className="text-[11.5px] text-ink-soft mt-1 mb-3">年間{count}回分の月を選択してください。連続していなくても設定できます。</div>
        <div className="grid grid-cols-4 gap-2">
          {FISCAL_MONTHS.map(month => {
            const selected = months.includes(month);
            return (
              <button key={month} type="button" aria-pressed={selected} onClick={() => toggleMonth(month)}
                className={`rounded-lg border px-1 py-2.5 text-[13px] font-bold transition-colors ${selected ? "border-blue-500 bg-blue-500/10 text-blue-700" : "border-line bg-paper text-ink-soft"}`}>
                {month}月 {selected ? "✓" : ""}
              </button>
            );
          })}
        </div>
        <div className={`mt-2 text-[12px] font-bold ${months.length === count ? "text-ink-soft" : "text-red-600"}`}>
          {months.length} / {count}か月選択中
        </div>
      </div>

      <div className={`${cardClass} mt-3`}>
        <div className="text-[14px] font-bold mb-2">途中加入・退団時の請求</div>
        <div className="flex flex-col gap-2">
          {([
            ["prorated", "在籍期間に応じて請求", "年間金額を在籍月数に応じて計算する"],
            ["full", "全額を請求", "途中加入でも在籍があれば年間分を請求する"],
          ] as const).map(([value, label, help]) => (
            <label key={value} className={`flex gap-2 rounded-lg border p-3 cursor-pointer ${joinLeaveRule === value ? "border-blue-500" : "border-line"}`}>
              <input type="radio" name="join-leave-rule" checked={joinLeaveRule === value} onChange={() => setJoinLeaveRule(value)} />
              <span><span className="block font-bold text-[12.5px]">{label}</span><span className="block text-[11px] text-ink-soft mt-0.5">{help}</span></span>
            </label>
          ))}
        </div>
      </div>

      {errors.length > 0 && (
        <div role="alert" className="mt-3 text-[12px] text-red-600">{errors.join(" / ")}</div>
      )}
      <div className="mt-4 text-[12px] text-ink-soft">
        この画面では保存できません。新方式の請求生成とデータベース連携を実装後、正式な設定画面に統合します。
      </div>
      <Link href="/accounting/dues" className="block mt-3 text-center text-[12px] font-bold underline">集金項目一覧へ戻る</Link>
    </PageShell>
  );
}
