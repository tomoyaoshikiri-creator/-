"use client";

import Link from "next/link";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, SectionLabel } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import { canManageSettings } from "@/lib/permissions";

function SettingsRow({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between py-2.5 border-b border-line last:border-b-0">
      <div className="font-bold text-[13.5px]">{label}</div>
      <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
    </Link>
  );
}

export default function SettingsPage() {
  const { role } = useSession();
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
            <SettingsRow href="/settings/plan" label="プラン" />
          </Card>
        </>
      )}

      <SectionLabel>規約・ポリシー</SectionLabel>
      <Card>
        <SettingsRow href="/privacy" label="プライバシーポリシー" />
        <SettingsRow href="/terms" label="利用規約" />
        <SettingsRow href="/tokushoho" label="特定商取引法に基づく表記" />
      </Card>
    </PageShell>
  );
}
