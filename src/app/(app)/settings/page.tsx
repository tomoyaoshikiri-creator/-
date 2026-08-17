"use client";

import Link from "next/link";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, SectionLabel } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import { canManageSettings } from "@/lib/permissions";
import { PLAN_DISPLAY_LABELS } from "@/lib/format";
import { SPORT_DISPLAY_LABELS } from "@/lib/sport";

function SettingsRow({ href, label, value }: { href: string; label: string; value?: string }) {
  return (
    <Link href={href} className="flex items-center justify-between py-2.5 border-b border-line last:border-b-0">
      <div className="font-bold text-[13.5px]">{label}</div>
      <div className="flex items-center gap-1.5">
        {value && <div className="text-[12.5px] text-ink-soft">{value}</div>}
        <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
      </div>
    </Link>
  );
}

// 競技は作成時に選ぶだけで後から変更するUIを持たないため、リンクにはせず
// ラベルとして表示するだけの行にする(プッシュ通知トグルの行と同じ非遷移パターン)。
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-line last:border-b-0">
      <div className="font-bold text-[13.5px]">{label}</div>
      <div className="text-[12.5px] text-ink-soft">{value}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { role, plan, sport } = useSession();
  const canManageTeam = canManageSettings(role);

  return (
    <PageShell header={<AppHeader title="設定" />}>
      <SectionLabel>アカウント</SectionLabel>
      <Card>
        <SettingsRow href="/settings/name" label="表示名の変更" />
        <SettingsRow href="/settings/password" label="パスワードを変更" />
        <PushNotificationToggle />
      </Card>

      {canManageTeam && (
        <>
          <SectionLabel>チーム設定</SectionLabel>
          <Card>
            <SettingsRow href="/settings/logo" label="ログイン画面" />
            <SettingsRow href="/settings/color" label="配色" />
            <SettingsRow href="/settings/storage" label="使用量" />
            <SettingsRow href="/settings/plan" label="プラン" value={`現在のプラン: ${PLAN_DISPLAY_LABELS[plan]}`} />
            <InfoRow label="使用競技" value={SPORT_DISPLAY_LABELS[sport]} />
          </Card>
        </>
      )}

      <SectionLabel>規約・ポリシー</SectionLabel>
      <Card>
        <SettingsRow href="/privacy" label="プライバシーポリシー" />
        <SettingsRow href="/terms" label="利用規約" />
        <SettingsRow href="/tokushoho" label="特定商取引法に基づく表記" />
      </Card>

      {canManageTeam && (
        <>
          <SectionLabel>危険な操作</SectionLabel>
          <Card>
            <SettingsRow href="/settings/close-account" label="チームを退会する" />
          </Card>
        </>
      )}
    </PageShell>
  );
}
