"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";

export default function KarteTeamGoalPage() {
  const router = useRouter();
  const { role, teamId, teamGoal: savedTeamGoal } = useSession();
  const toast = useToast();

  const [teamGoal, setTeamGoal] = useState(savedTeamGoal ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (role !== "管理者") router.replace("/karte/team");
  }, [role, router]);

  useUnsavedChangesGuard(teamGoal !== (savedTeamGoal ?? ""));

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const trimmed = teamGoal.trim();
    const { error } = await supabase
      .from("teams")
      .update({ team_goal: trimmed || null })
      .eq("id", teamId);
    setSaving(false);
    if (error) {
      toast(`保存に失敗しました: ${error.message}`);
      return;
    }
    toast("チーム目標を更新しました");
    router.refresh();
  }

  return (
    <PageShell header={<AppHeader title="チーム目標" variant="detail" backHref="/karte/team" accessBadge="admin" />}>
      <SectionLabel>チーム目標</SectionLabel>
      <Card>
        <FieldLabel>ホーム画面に表示する目標</FieldLabel>
        <textarea
          rows={3}
          className={inputClass()}
          value={teamGoal}
          onChange={(e) => setTeamGoal(e.target.value)}
          placeholder="例: 県大会ベスト8"
        />
        <div className="text-xs text-ink-soft mt-2">
          空欄にして保存すると、ホーム画面から目標のカードが消えます。全ロールのホーム画面に表示されます。
        </div>
        <SubmitButton onClick={handleSave} disabled={saving}>
          {saving ? "保存中…" : "保存する"}
        </SubmitButton>
      </Card>
    </PageShell>
  );
}
