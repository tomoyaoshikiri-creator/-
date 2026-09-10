"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";

const CONFIRM_PHRASE = "退会する";

type Result = { immediate: boolean; pendingTeams: string[] };

// 「このサービスから退会する」= あなた個人のアカウント(ログイン情報)を完全に削除する。
// 「チームを退会する」(settings/close-account、管理者によるチームデータ自体の削除)とは
// 別の操作であることを画面・文言の両方で明確に分けている(A-7)。
export default function LeaveServicePage() {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function handleLeave() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/request-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "退会手続きに失敗しました");
        setSubmitting(false);
        return;
      }
      setResult({ immediate: Boolean(data.immediate), pendingTeams: data.pendingTeams ?? [] });
    } catch {
      setError("退会手続きに失敗しました");
      setSubmitting(false);
    }
  }

  async function handleBackToLogin() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (result) {
    return (
      <PageShell header={<AppHeader title="このサービスから退会する" variant="detail" />}>
        <Card>
          <div className="font-bold text-[13.5px] mb-2">退会手続きを受け付けました</div>
          {result.immediate ? (
            <div className="text-[12.5px] text-ink-soft leading-relaxed">アカウントを削除しました。ご利用ありがとうございました。</div>
          ) : (
            <div className="text-[12.5px] text-ink-soft leading-relaxed">
              管理しているチーム({result.pendingTeams.join("・")})は7日後にすべてのデータが削除されます。あなたのアカウントは、その時点で削除されます。7日以内であれば、チーム設定から取り消せます。
            </div>
          )}
          <SubmitButton onClick={handleBackToLogin}>ログイン画面に戻る</SubmitButton>
        </Card>
      </PageShell>
    );
  }

  const canSubmit = confirmText === CONFIRM_PHRASE && password.length > 0;

  return (
    <PageShell header={<AppHeader title="このサービスから退会する" variant="detail" backHref="/settings" />}>
      <Card>
        <div className="font-bold text-[13.5px] mb-2">この操作について</div>
        <ul className="text-[12.5px] text-ink-soft leading-relaxed list-disc pl-4 space-y-1">
          <li>あなた個人のCIRCLE LINESアカウント(ログイン情報)を完全に削除します。チームのデータ自体を消す操作ではありません</li>
          <li>
            所属しているチームのうち、あなたが「唯一の管理者」であるチームがある場合、そのチームは既存の「チームを退会する」と同じく7日後にすべてのデータが削除され、その時点であなたのアカウントも削除されます(7日以内はチーム設定から取り消し可能です)
          </li>
          <li>あなたが唯一の管理者ではないチーム(他に管理者がいる、または一般・運営・指導者としての所属)からは、即座に脱退します</li>
          <li>管理しているチームが1つもなければ、アカウントは即座に削除されます</li>
          <li>この操作は取り消せません(唯一の管理者であるチームの7日以内の取り消しを除く)</li>
        </ul>
      </Card>

      <Card>
        <FieldLabel>本人確認のため、現在のパスワードを入力してください</FieldLabel>
        <input
          type="password"
          className={inputClass()}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="mt-3">
          <FieldLabel>確認のため、「{CONFIRM_PHRASE}」と入力してください</FieldLabel>
          <input
            className={inputClass()}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_PHRASE}
          />
        </div>

        {error && <div className="mt-3 text-[12.5px] text-danger">{error}</div>}
        <button
          type="button"
          onClick={handleLeave}
          disabled={!canSubmit || submitting}
          className="mt-3.5 w-full py-2.5 rounded-lg font-bold text-[13px] active:opacity-85 disabled:opacity-50 border"
          style={{ color: "var(--danger)", borderColor: "var(--danger)", background: "white" }}
        >
          {submitting ? "処理中…" : "このサービスから退会する"}
        </button>
      </Card>
    </PageShell>
  );
}
