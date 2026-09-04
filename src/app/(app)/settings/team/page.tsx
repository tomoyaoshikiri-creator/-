"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, SectionLabel } from "@/components/ui/Card";
import { SettingsRow } from "@/components/SettingsRow";
import { canManageSettings } from "@/lib/permissions";
import { PLAN_DISPLAY_LABELS } from "@/lib/format";
import { SPORT_DISPLAY_LABELS } from "@/lib/sport";
import { CATEGORY_DISPLAY_LABELS } from "@/lib/category";

export default function SettingsTeamPage() {
  const router = useRouter();
  const { role, plan, sport, category } = useSession();

  useEffect(() => {
    if (!canManageSettings(role)) router.replace("/settings");
  }, [role, router]);

  return (
    <PageShell header={<AppHeader title="チーム設定" variant="detail" backHref="/settings" accessBadge="admin" />}>
      <SectionLabel>チーム</SectionLabel>
      <Card>
        <SettingsRow href="/settings/logo" label="ログイン画面" />
        <SettingsRow href="/settings/color" label="配色" />
        <SettingsRow href="/settings/storage" label="使用量" />
        <SettingsRow href="/settings/plan" label="プラン" value={`現在のプラン: ${PLAN_DISPLAY_LABELS[plan]}`} />
        <SettingsRow
          href="/settings/category"
          label="カテゴリー"
          value={`${CATEGORY_DISPLAY_LABELS[category]} / ${SPORT_DISPLAY_LABELS[sport]}`}
        />
      </Card>

      <SectionLabel>危険な操作</SectionLabel>
      <Card>
        <SettingsRow href="/settings/close-account" label="チームを退会する" />
      </Card>
    </PageShell>
  );
}
