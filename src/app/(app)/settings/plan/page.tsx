"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, SectionLabel } from "@/components/ui/Card";
import { SegButton, SubmitButton } from "@/components/ui/SegButton";
import { canManageSettings } from "@/lib/permissions";
import { isInquiryPlan, isPublicPlan } from "@/lib/plan";
import { shouldUseBillingPortal } from "@/lib/billing";
import { PLAN_DISPLAY_LABELS } from "@/lib/format";
import type { BillingInterval } from "@/lib/stripe";
import type { TeamPlan } from "@/lib/database.types";

export default function SettingsPlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { role, teamId } = useSession();
  const [plan, setPlan] = useState<TeamPlan | null>(null);
  const [useBillingPortal, setUseBillingPortal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [billingLoading, setBillingLoading] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");

  useEffect(() => {
    if (!canManageSettings(role)) {
      router.replace("/settings");
    }
  }, [role, router]);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") toast("お申し込みが完了しました");
    if (checkout === "cancel") toast("お申し込みを中断しました");
  }, [searchParams, toast]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: team } = await supabase
        .from("teams")
        .select("plan, subscription_status")
        .eq("id", teamId)
        .single();
      setPlan(team?.plan ?? null);
      setUseBillingPortal(shouldUseBillingPortal(team?.subscription_status));
      setLoading(false);
    })();
  }, [teamId]);

  async function startCheckout(targetPlan: "中間" | "フル" | "フルプラス") {
    setBillingLoading(targetPlan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: targetPlan, interval: billingInterval }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast(`お申し込みページの作成に失敗しました${data.error ? `: ${data.error}` : ""}`);
        return;
      }
      window.location.href = data.url;
    } finally {
      setBillingLoading(null);
    }
  }

  async function openBillingPortal() {
    setBillingLoading("portal");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast(`お支払い管理ページの作成に失敗しました${data.error ? `: ${data.error}` : ""}`);
        return;
      }
      window.location.href = data.url;
    } finally {
      setBillingLoading(null);
    }
  }

  return (
    <PageShell header={<AppHeader title="プラン" variant="detail" backHref="/settings" accessBadge="admin" />}>
      <SectionLabel>プラン</SectionLabel>
      {loading ? (
        <div className="text-[12.5px] text-ink-soft text-center py-5">読み込み中…</div>
      ) : (
        <Card>
          {plan && (
            <div className="mb-2.5">
              <div className="text-[11px] font-bold text-orange">現在のプラン: {PLAN_DISPLAY_LABELS[plan]}</div>
              {plan === "お試し" && (
                <div className="text-[11px] text-ink-soft mt-0.5">まずはCIRCLE LINESを試してみたいチーム向け・¥0</div>
              )}
            </div>
          )}
          {plan && isInquiryPlan(plan) ? (
            <div className="text-xs text-ink-soft">
              特別プランが適用されています。プラン内容についてのお問い合わせは運営までご連絡ください。
            </div>
          ) : plan && !isPublicPlan(plan) ? (
            <div className="text-xs text-ink-soft">
              特別プランが適用されています。プラン内容の変更については運営までお問い合わせください。
            </div>
          ) : useBillingPortal ? (
            <>
              <div className="text-xs text-ink-soft mb-2.5">
                お支払い方法の変更・請求履歴の確認・解約は、Stripeのお支払い管理ページから行えます。
              </div>
              <SubmitButton onClick={openBillingPortal} disabled={billingLoading !== null} className="!mt-0">
                {billingLoading === "portal" ? "処理中…" : "お支払いを管理する"}
              </SubmitButton>
            </>
          ) : (
            <>
              <div className="text-xs text-ink-soft mb-2.5">有料プランに申し込むと、利用できる機能が広がります。</div>
              <div className="flex gap-1.5 mb-3">
                <SegButton variant="small" active={billingInterval === "monthly"} onClick={() => setBillingInterval("monthly")}>
                  月払い
                </SegButton>
                <SegButton variant="small" active={billingInterval === "yearly"} onClick={() => setBillingInterval("yearly")}>
                  年払い(10%オフ)
                </SegButton>
              </div>
              {PLAN_OPTIONS.map((opt) => (
                <div
                  key={opt.plan}
                  className={`rounded-[10px] p-3 mb-2.5 border ${opt.highlight ? "border-orange bg-orange/5" : "border-line bg-paper"}`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="font-bold text-[13px]">{PLAN_DISPLAY_LABELS[opt.plan]}</div>
                    {opt.highlight && (
                      <span className="text-[9.5px] font-bold text-white bg-orange rounded-full px-1.5 py-0.5">
                        主力プラン
                      </span>
                    )}
                  </div>
                  <div className="text-[12.5px] font-bold text-ink mb-1">
                    {billingInterval === "monthly" ? opt.price : opt.yearlyPrice}
                    <span className="text-[10.5px] font-normal text-ink-soft">
                      {billingInterval === "monthly" ? "/月(税込)" : "/年(税込)"}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-soft mb-2">{opt.desc}</div>
                  <SubmitButton onClick={() => startCheckout(opt.plan)} disabled={billingLoading !== null} className="!mt-0">
                    {billingLoading === opt.plan ? "処理中…" : `${PLAN_DISPLAY_LABELS[opt.plan]}プランに申し込む`}
                  </SubmitButton>
                </div>
              ))}
              <a href="/tokushoho" target="_blank" className="block text-center text-[11px] text-ink-soft underline mt-3">
                特定商取引法に基づく表記
              </a>
            </>
          )}
        </Card>
      )}
    </PageShell>
  );
}

const PLAN_OPTIONS: {
  plan: "中間" | "フル" | "フルプラス";
  price: string;
  yearlyPrice: string;
  desc: string;
  highlight?: boolean;
}[] = [
  { plan: "中間", price: "¥1,280", yearlyPrice: "¥13,824", desc: "日々のチーム運営をまとめて管理したいチーム向け", highlight: true },
  { plan: "フル", price: "¥2,480", yearlyPrice: "¥26,784", desc: "選手・チームの成長をデータで管理したいチーム向け" },
  { plan: "フルプラス", price: "¥3,280", yearlyPrice: "¥35,424", desc: "データ分析までAIに任せたいチーム向け" },
];
