"use client";

import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, SectionLabel } from "@/components/ui/Card";
import { SettingsRow } from "@/components/SettingsRow";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import { canManageSettings } from "@/lib/permissions";

export default function SettingsPage() {
  const { role, hasMultipleTeams } = useSession();
  const canManageTeam = canManageSettings(role);

  return (
    <PageShell header={<AppHeader title="設定" variant="detail" backHref="/home" />}>
      <SectionLabel>アカウント</SectionLabel>
      <Card>
        <SettingsRow href="/settings/name" label="表示名の変更" />
        <SettingsRow href="/settings/password" label="パスワードを変更" />
        <SettingsRow href="/settings/teams/new" label="新しいチームを作成" />
        {hasMultipleTeams && <SettingsRow href="/select-team" label="所属チームを切り替える" />}
        <PushNotificationToggle />
      </Card>

      {canManageTeam && (
        <>
          <SectionLabel>チーム</SectionLabel>
          <Card>
            <SettingsRow href="/settings/team" label="チーム設定" />
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
