// 公開/pricingページと設定画面(お申し込み)の両方から参照する料金表示データ。
// 実際の課金額はStripe側のPrice ID(src/lib/stripe.ts の PAID_PLAN_PRICE_ENV)が
// source of truthで、ここは表示用の文言のみ。値を変更する場合はStripe側の価格と
// 揃えること(src/lib/plan.tsの相互参照コメントと同じ運用)。
export const PLAN_PRICING_OPTIONS: {
  plan: "中間" | "フル" | "フルプラス";
  price: string;
  yearlyPrice: string;
  desc: string;
  highlight?: boolean;
}[] = [
  { plan: "中間", price: "¥980", yearlyPrice: "¥9,800", desc: "日々のチーム運営をまとめて管理したいチーム向け", highlight: true },
  { plan: "フル", price: "¥2,180", yearlyPrice: "¥21,800", desc: "選手・チームの成長をデータで管理したいチーム向け" },
  { plan: "フルプラス", price: "¥2,980", yearlyPrice: "¥29,800", desc: "データ分析までAIに任せたいチーム向け" },
];
