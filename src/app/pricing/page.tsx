import Link from "next/link";
import { PLAN_PRICING_OPTIONS } from "@/lib/planPricing";
import { PLAN_DISPLAY_LABELS } from "@/lib/format";

export const metadata = { title: "料金プラン | CIRCLE LINES" };

export default function PricingPage() {
  return (
    <div className="min-h-full bg-paper text-ink">
      <div className="max-w-[720px] mx-auto px-6 py-12">
        <Link href="/" className="text-[12px] text-ink-soft underline">
          ‹ トップに戻る
        </Link>

        <h1 className="font-medium text-2xl mt-6 mb-2">料金プラン</h1>
        <p className="text-[12.5px] text-ink-soft mb-8">チームの規模・やりたいことに合わせて選べます。いつでもプラン変更できます。</p>

        <div className="rounded-lg border border-line bg-white p-4 mb-3">
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="font-bold text-[14px]">{PLAN_DISPLAY_LABELS["お試し"]}</div>
            <span className="text-[9.5px] font-bold text-white bg-ink-soft rounded-full px-1.5 py-0.5">まずはお試し</span>
          </div>
          <div className="text-[13px] font-bold text-ink mb-1">
            ¥0<span className="text-[10.5px] font-normal text-ink-soft">/ずっと無料</span>
          </div>
          <div className="text-[11.5px] text-ink-soft">選手登録15人まで・容量100MBまで。基本機能はすべて利用できます。</div>
        </div>

        {PLAN_PRICING_OPTIONS.map((opt) => (
          <div
            key={opt.plan}
            className={`rounded-lg p-4 mb-3 border ${opt.highlight ? "border-orange bg-orange/5" : "border-line bg-white"}`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="font-bold text-[14px]">{PLAN_DISPLAY_LABELS[opt.plan]}</div>
              {opt.highlight && (
                <span className="text-[9.5px] font-bold text-white bg-orange rounded-full px-1.5 py-0.5">主力プラン</span>
              )}
            </div>
            <div className="text-[13px] font-bold text-ink mb-1">
              {opt.price}
              <span className="text-[10.5px] font-normal text-ink-soft">/月(税込)</span>
              <span className="text-[11px] font-normal text-ink-soft ml-2">年払い {opt.yearlyPrice}/年</span>
            </div>
            <div className="text-[11.5px] text-ink-soft">{opt.desc}</div>
          </div>
        ))}

        <div className="rounded-lg border border-line bg-white p-4 mb-8">
          <div className="font-bold text-[14px] mb-0.5">{PLAN_DISPLAY_LABELS["Max"]}</div>
          <div className="text-[13px] font-bold text-ink mb-1">個別見積もり</div>
          <div className="text-[11.5px] text-ink-soft">
            スポーツテスト・各種検定など、大規模チーム向けの機能を含みます。お問い合わせください。
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/signup"
            className="inline-block rounded-lg bg-orange text-white font-bold text-[13px] px-8 py-3"
          >
            無料で始める
          </Link>
        </div>

        <div className="text-center mt-6">
          <a href="/tokushoho" target="_blank" className="text-[11px] text-ink-soft underline">
            特定商取引法に基づく表記
          </a>
        </div>
      </div>
    </div>
  );
}
