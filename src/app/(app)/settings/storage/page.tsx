"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, SectionLabel } from "@/components/ui/Card";
import { canManageSettings } from "@/lib/permissions";
import { formatBytes, PLAN_DISPLAY_LABELS } from "@/lib/format";
import type { TeamPlan } from "@/lib/database.types";

export default function SettingsStoragePage() {
  const router = useRouter();
  const { role, teamId } = useSession();
  const [plan, setPlan] = useState<TeamPlan | null>(null);
  const [usedBytes, setUsedBytes] = useState(0);
  const [limitBytes, setLimitBytes] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canManageSettings(role)) {
      router.replace("/settings");
    }
  }, [role, router]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: team }, { data: usage }] = await Promise.all([
        supabase.from("teams").select("plan, storage_limit_bytes").eq("id", teamId).single(),
        supabase.rpc("team_storage_usage_bytes"),
      ]);
      setPlan(team?.plan ?? null);
      setLimitBytes(team?.storage_limit_bytes ?? 0);
      setUsedBytes(usage ?? 0);
      setLoading(false);
    })();
  }, [teamId]);

  const percent = limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes) * 100) : 0;

  return (
    <PageShell header={<AppHeader title="使用量" variant="detail" backHref="/settings" accessBadge="admin" />}>
      <SectionLabel>ストレージ使用量</SectionLabel>
      {loading ? (
        <div className="text-[12.5px] text-ink-soft text-center py-5">読み込み中…</div>
      ) : (
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
      )}
    </PageShell>
  );
}
