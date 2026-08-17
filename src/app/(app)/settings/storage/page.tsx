"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, SectionLabel } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SegButton";
import { canManageSettings } from "@/lib/permissions";
import { formatBytes, PLAN_DISPLAY_LABELS } from "@/lib/format";
import type { TeamPlan } from "@/lib/database.types";

export default function SettingsStoragePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { role, teamId } = useSession();
  const [plan, setPlan] = useState<TeamPlan | null>(null);
  const [usedBytes, setUsedBytes] = useState(0);
  const [limitBytes, setLimitBytes] = useState(0);
  const [hasCustomer, setHasCustomer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [billingLoading, setBillingLoading] = useState<string | null>(null);

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
      const [{ data: team }, { data: usage }] = await Promise.all([
        supabase.from("teams").select("plan, storage_limit_bytes, stripe_customer_id").eq("id", teamId).single(),
        supabase.rpc("team_storage_usage_bytes"),
      ]);
      setPlan(team?.plan ?? null);
      setLimitBytes(team?.storage_limit_bytes ?? 0);
      setHasCustomer(Boolean(team?.stripe_customer_id));
      setUsedBytes(usage ?? 0);
      setLoading(false);
    })();
  }, [teamId]);

  async function startCheckout(targetPlan: "中間" | "フル") {
    setBillingLoading(targetPlan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: targetPlan }),
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

  const percent = limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes) * 100) : 0;

  return (
    <PageShell header={<AppHeader title="使用量" variant="detail" backHref="/settings" accessBadge="admin" />}>
      <SectionLabel>ストレージ使用量</SectionLabel>
      {loading ? (
        <div className="text-[12.5px] text-ink-soft text-center py-5">読み込み中…</div>
      ) : (
        <>
          <Card>
            {plan && <div className="text-[11px] font-bold text-orange mb-1">{PLAN_DISPLAY_LABELS[plan]}プラン</div>}
            <div className="flex items-end justify-between">
              <div className="font-bold text-[20px]">{formatBytes(usedBytes)}</div>
              <div className="text-[12.5px] text-ink-soft mb-0.5">/ {formatBytes(limitBytes)}</div>
            </div>
            <div className="mt-2.5 h-2 rounded-full bg-paper overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${percent}%`,
                  background: percent >= 90 ? "var(--danger)" : "var(--orange)",
                }}
              />
            </div>
            <div className="text-xs text-ink-soft mt-2">
              ライブラリ・お知らせ・チーム日報・コーチ日報に添付された画像・資料の合計サイズです。
            </div>
          </Card>

          <SectionLabel>プラン</SectionLabel>
          <Card>
            {plan === "Max" ? (
              <div className="text-xs text-ink-soft">
                特別プランが適用されています。プラン内容についてのお問い合わせは運営までご連絡ください。
              </div>
            ) : hasCustomer ? (
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
                <div className="text-xs text-ink-soft mb-2.5">
                  有料プランに申し込むと、ストレージの上限が広がります。
                </div>
                <SubmitButton
                  onClick={() => startCheckout("中間")}
                  disabled={billingLoading !== null}
                  className="!mt-0"
                >
                  {billingLoading === "中間" ? "処理中…" : `${PLAN_DISPLAY_LABELS["中間"]}プランに申し込む`}
                </SubmitButton>
                <SubmitButton onClick={() => startCheckout("フル")} disabled={billingLoading !== null}>
                  {billingLoading === "フル" ? "処理中…" : `${PLAN_DISPLAY_LABELS["フル"]}プランに申し込む`}
                </SubmitButton>
                <a href="/tokushoho" target="_blank" className="block text-center text-[11px] text-ink-soft underline mt-3">
                  特定商取引法に基づく表記
                </a>
              </>
            )}
          </Card>
        </>
      )}
    </PageShell>
  );
}
