"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, SectionLabel } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { SettingsRow } from "@/components/SettingsRow";
import { canManageSettings } from "@/lib/permissions";
import { PLAN_DISPLAY_LABELS } from "@/lib/format";
import { SPORT_DISPLAY_LABELS } from "@/lib/sport";
import { CATEGORY_DISPLAY_LABELS } from "@/lib/category";

export default function SettingsTeamPage() {
  const router = useRouter();
  const toast = useToast();
  const { role, plan, sport, category, teamId, requireUnlinkedGuardianAttendance } = useSession();

  useEffect(() => {
    if (!canManageSettings(role)) router.replace("/settings");
  }, [role, router]);

  const [attendanceToggle, setAttendanceToggle] = useState(requireUnlinkedGuardianAttendance);
  const [savingAttendanceToggle, setSavingAttendanceToggle] = useState(false);

  useEffect(() => {
    setAttendanceToggle(requireUnlinkedGuardianAttendance);
  }, [requireUnlinkedGuardianAttendance]);

  async function handleToggleAttendance(next: boolean) {
    setAttendanceToggle(next);
    setSavingAttendanceToggle(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("teams")
      .update({ require_unlinked_guardian_attendance: next })
      .eq("id", teamId);
    setSavingAttendanceToggle(false);
    if (error) {
      setAttendanceToggle(!next);
      toast(`保存に失敗しました: ${error.message}`);
      return;
    }
    router.refresh();
  }

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

      <SectionLabel>出欠</SectionLabel>
      <Card>
        <div className="flex items-center justify-between py-1 gap-3">
          <div className="min-w-0">
            <div className="font-bold text-[13.5px]">選手と紐づいていないメンバーの出欠</div>
            <div className="text-[11px] text-ink-soft mt-0.5">
              OFFにすると、選手と紐づいていない一般・運営メンバーは自分自身の出欠登録を求められなくなります(通知・「要対応」表示も対象外になります)
            </div>
          </div>
          <Switch checked={attendanceToggle} onChange={handleToggleAttendance} disabled={savingAttendanceToggle} />
        </div>
      </Card>

      <SectionLabel>危険な操作</SectionLabel>
      <Card>
        <SettingsRow href="/settings/close-account" label="チームを退会する" />
      </Card>
    </PageShell>
  );
}
