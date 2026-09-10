"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { canManageSettings } from "@/lib/permissions";
import { formatDateTimeLabel } from "@/lib/format";
import type { AuditAction } from "@/lib/database.types";

const ACTION_LABELS: Record<AuditAction, string> = {
  role_changed: "ロール変更",
  invite_issued: "招待を発行",
  invite_revoked: "招待を取消",
  member_removed: "メンバーを削除",
  team_leave: "チームを脱退",
  team_deletion_requested: "チーム退会(完全削除)を申請",
  ai_analysis_generated: "AI分析を生成",
  billing_plan_changed: "プランが変更",
  billing_subscription_canceled: "サブスクリプションが解約",
  data_export: "データをエクスポート",
};

function describeDetail(action: AuditAction, detail: unknown): string | null {
  const d = (detail ?? {}) as Record<string, unknown>;
  switch (action) {
    case "role_changed":
      return typeof d.from_role === "string" && typeof d.to_role === "string" ? `${d.from_role} → ${d.to_role}` : null;
    case "invite_issued":
    case "invite_revoked":
      return typeof d.role === "string" ? `${d.role}向け招待` : null;
    case "member_removed":
      return typeof d.target_name === "string" ? d.target_name : null;
    case "ai_analysis_generated":
      return d.scope === "player" ? "選手分析" : d.scope === "team" ? "チーム分析" : null;
    case "billing_plan_changed":
      return typeof d.plan === "string" ? `${d.plan}(${d.subscription_status ?? "-"})` : null;
    default:
      return null;
  }
}

interface AuditLogRow {
  id: string;
  actor_id: string | null;
  action: AuditAction;
  detail: unknown;
  created_at: string;
}

export default function AuditLogPage() {
  const router = useRouter();
  const { role } = useSession();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [actorNames, setActorNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canManageSettings(role)) {
      router.replace("/settings");
    }
  }, [role, router]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("audit_logs")
        .select("id, actor_id, action, detail, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      const logs = data ?? [];
      setRows(logs);

      const actorIds = [...new Set(logs.map((l) => l.actor_id).filter((id): id is string => id !== null))];
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", actorIds);
        setActorNames(new Map((profiles ?? []).map((p) => [p.id, p.name])));
      }
      setLoading(false);
    })();
  }, []);

  return (
    <PageShell header={<AppHeader title="監査ログ" variant="detail" backHref="/settings/team" accessBadge="admin" />}>
      <SectionLabel>操作履歴(直近200件)</SectionLabel>
      {loading ? (
        <div className="text-[12.5px] text-ink-soft text-center py-5">読み込み中…</div>
      ) : rows.length === 0 ? (
        <EmptyState>まだ記録がありません</EmptyState>
      ) : (
        <Card>
          <ul>
            {rows.map((row) => {
              const detailText = describeDetail(row.action, row.detail);
              return (
                <li key={row.id} className="py-2.5 border-b border-line last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-[13px]">{ACTION_LABELS[row.action]}</div>
                    <div className="text-[11px] text-ink-soft whitespace-nowrap">{formatDateTimeLabel(row.created_at)}</div>
                  </div>
                  <div className="text-[12px] text-ink-soft mt-0.5">
                    {row.actor_id ? (actorNames.get(row.actor_id) ?? "退会済みユーザー") : "システム(Stripe連携)"}
                    {detailText && <span> ・ {detailText}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </PageShell>
  );
}
