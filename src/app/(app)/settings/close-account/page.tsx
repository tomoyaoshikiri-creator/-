"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";
import { FieldLabel, inputClass } from "@/components/ui/SegButton";
import { canManageSettings } from "@/lib/permissions";

export default function CloseAccountPage() {
  const router = useRouter();
  const toast = useToast();
  const { role, teamName } = useSession();
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canManageSettings(role)) router.replace("/settings");
  }, [role, router]);

  async function handleRequestDeletion() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/team/request-deletion", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "退会手続きに失敗しました");
        return;
      }
      toast("退会手続きを受け付けました");
      router.refresh();
    } catch {
      setError("退会手続きに失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = confirmText === teamName;

  return (
    <PageShell header={<AppHeader title="チームを退会する" variant="detail" backHref="/settings/team" accessBadge="admin" />}>
      <Card>
        <div className="font-bold text-[13.5px] mb-2">この操作について</div>
        <ul className="text-[12.5px] text-ink-soft leading-relaxed list-disc pl-4 space-y-1">
          <li>退会申請すると、選手・試合記録・カルテなどチームのすべてのデータが7日後に完全に削除されます</li>
          <li>有料プランをご契約中の場合、この時点でStripeの契約は即時解約されます(以降の請求は発生しません)</li>
          <li>7日以内であれば「設定」からいつでも取り消せます(データは復元されます)</li>
          <li>7日を過ぎると、いかなる理由でも元に戻せません</li>
        </ul>
      </Card>

      <Card>
        <FieldLabel>
          確認のため、チーム名「{teamName}」を入力してください
        </FieldLabel>
        <input
          className={inputClass()}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={teamName}
        />
        {error && <div className="mt-3 text-[12.5px] text-danger">{error}</div>}
        <button
          type="button"
          onClick={handleRequestDeletion}
          disabled={!canSubmit || submitting}
          className="mt-3.5 w-full py-2.5 rounded-lg font-bold text-[13px] active:opacity-85 disabled:opacity-50 border"
          style={{ color: "var(--danger)", borderColor: "var(--danger)", background: "white" }}
        >
          {submitting ? "処理中…" : "チームを退会する"}
        </button>
      </Card>
    </PageShell>
  );
}
