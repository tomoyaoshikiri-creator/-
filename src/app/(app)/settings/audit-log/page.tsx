"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { LockedFeatureCard } from "@/components/PlanLock";
import { canManageSettings } from "@/lib/permissions";
import { hasAdvancedAuditLogAccess } from "@/lib/plan";
import { formatDateTimeLabel } from "@/lib/format";
import { AUDIT_ACTION_LABELS, describeAuditDetail } from "@/lib/auditLogDisplay";
import type { AuditAction } from "@/lib/database.types";

const FILTER_PAGE_SIZE = 50;

// "YYYY-MM-DD"の翌日を返す(終了日の境界を[from, to)の排他的上限にするため)。
function nextDayStr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface AuditLogRow {
  id: string;
  actor_id: string | null;
  action: AuditAction;
  detail: unknown;
  created_at: string;
}

interface TeamMember {
  id: string;
  name: string;
}

function AuditLogRowItem({ row, actorName }: { row: AuditLogRow; actorName: string }) {
  const detailText = describeAuditDetail(row.action, row.detail);
  return (
    <li className="py-2.5 border-b border-line last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <div className="font-bold text-[13px]">{AUDIT_ACTION_LABELS[row.action]}</div>
        <div className="text-[11px] text-ink-soft whitespace-nowrap">{formatDateTimeLabel(row.created_at)}</div>
      </div>
      <div className="text-[12px] text-ink-soft mt-0.5">
        {actorName}
        {detailText && <span> ・ {detailText}</span>}
      </div>
    </li>
  );
}

// 絞り込み検索・CSV出力(M-3、Max限定)。期間・操作種別・操作者で絞り込み、
// 「もっと見る」方式でページングする(全件取得はしない)。基本の一覧(直近200件、
// 全プラン共通)とはクエリ・状態を分離し、既存の閲覧機能には影響しない。
function AdvancedAuditLogSearch({ members }: { members: TeamMember[] }) {
  const toast = useToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [action, setAction] = useState<AuditAction | "">("");
  const [actorId, setActorId] = useState("");
  const [rows, setRows] = useState<AuditLogRow[] | null>(null);
  const [actorNames, setActorNames] = useState<Map<string, string>>(new Map());
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function runQuery(offset: number, append: boolean) {
    setLoading(true);
    try {
      const supabase = createClient();
      let query = supabase
        .from("audit_logs")
        .select("id, actor_id, action, detail, created_at")
        .order("created_at", { ascending: false })
        .range(offset, offset + FILTER_PAGE_SIZE - 1);
      if (from) query = query.gte("created_at", from);
      if (to) query = query.lt("created_at", nextDayStr(to));
      if (action) query = query.eq("action", action);
      if (actorId) query = query.eq("actor_id", actorId);

      const { data, error } = await query;
      if (error) {
        toast(`検索に失敗しました: ${error.message}`);
        return;
      }
      const fetched = data ?? [];
      setHasMore(fetched.length === FILTER_PAGE_SIZE);
      setRows((prev) => (append && prev ? [...prev, ...fetched] : fetched));

      const newActorIds = [...new Set(fetched.map((r) => r.actor_id).filter((id): id is string => id !== null))].filter(
        (id) => !actorNames.has(id),
      );
      if (newActorIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", newActorIds);
        setActorNames((prev) => {
          const next = new Map(prev);
          for (const p of profiles ?? []) next.set(p.id, p.name);
          return next;
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (action) params.set("action", action);
      if (actorId) params.set("actorId", actorId);
      const res = await fetch(`/api/audit-log/export?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast(json?.error ?? "出力に失敗しました");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "audit_log.csv";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <SectionLabel>絞り込み検索</SectionLabel>
      <Card>
        <div className="flex gap-2.5">
          <div className="flex-1">
            <FieldLabel htmlFor="audit-log-from">開始日</FieldLabel>
            <input id="audit-log-from" type="date" className={inputClass()} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex-1">
            <FieldLabel htmlFor="audit-log-to">終了日</FieldLabel>
            <input id="audit-log-to" type="date" className={inputClass()} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <FieldLabel htmlFor="audit-log-action">操作種別</FieldLabel>
        <select
          id="audit-log-action"
          className={inputClass()}
          value={action}
          onChange={(e) => setAction(e.target.value as AuditAction | "")}
        >
          <option value="">すべて</option>
          {(Object.keys(AUDIT_ACTION_LABELS) as AuditAction[]).map((a) => (
            <option key={a} value={a}>
              {AUDIT_ACTION_LABELS[a]}
            </option>
          ))}
        </select>
        <FieldLabel htmlFor="audit-log-actor">操作者</FieldLabel>
        <select id="audit-log-actor" className={inputClass()} value={actorId} onChange={(e) => setActorId(e.target.value)}>
          <option value="">すべて</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <SubmitButton onClick={() => runQuery(0, false)} disabled={loading}>
          {loading ? "検索中…" : "この条件で検索する"}
        </SubmitButton>
      </Card>

      {rows !== null && (
        <>
          <SectionLabel
            action={
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || rows.length === 0}
                className="flex-none px-3 py-1.5 rounded-lg border border-line text-[11px] font-bold text-ink-soft bg-paper disabled:opacity-50"
              >
                {exporting ? "出力中…" : "CSV出力"}
              </button>
            }
          >
            検索結果({rows.length}件)
          </SectionLabel>
          {rows.length === 0 ? (
            <EmptyState>条件に一致する記録がありません</EmptyState>
          ) : (
            <Card>
              <ul>
                {rows.map((row) => (
                  <AuditLogRowItem
                    key={row.id}
                    row={row}
                    actorName={row.actor_id ? (actorNames.get(row.actor_id) ?? "退会済みユーザー") : "システム(Stripe連携)"}
                  />
                ))}
              </ul>
            </Card>
          )}
          {hasMore && (
            <button
              type="button"
              onClick={() => runQuery(rows.length, true)}
              disabled={loading}
              className="w-full text-center py-2.5 rounded-lg font-bold text-[12.5px] border border-line bg-paper text-ink-soft mb-2.5"
            >
              {loading ? "読み込み中…" : "もっと見る"}
            </button>
          )}
        </>
      )}
    </>
  );
}

export default function AuditLogPage() {
  const router = useRouter();
  const { role, plan } = useSession();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [actorNames, setActorNames] = useState<Map<string, string>>(new Map());
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canManageSettings(role)) {
      router.replace("/settings");
    }
  }, [role, router]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data }, { data: teamMembers }] = await Promise.all([
        supabase
          .from("audit_logs")
          .select("id, actor_id, action, detail, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.rpc("list_team_members"),
      ]);
      const logs = data ?? [];
      setRows(logs);
      setMembers((teamMembers ?? []).map((m) => ({ id: m.id, name: m.name })));

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
            {rows.map((row) => (
              <AuditLogRowItem
                key={row.id}
                row={row}
                actorName={row.actor_id ? (actorNames.get(row.actor_id) ?? "退会済みユーザー") : "システム(Stripe連携)"}
              />
            ))}
          </ul>
        </Card>
      )}

      {hasAdvancedAuditLogAccess(plan) ? (
        <AdvancedAuditLogSearch members={members} />
      ) : (
        <>
          <SectionLabel>絞り込み検索</SectionLabel>
          <LockedFeatureCard label="絞り込み・CSV出力" description="期間・操作種別・操作者で絞り込んでCSV出力できます" requiredPlan="Max" />
        </>
      )}
    </PageShell>
  );
}
