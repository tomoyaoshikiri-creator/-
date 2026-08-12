"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";

export default function SettingsNamePage() {
  const router = useRouter();
  const { userId, name: sessionName } = useSession();
  const toast = useToast();
  const [name, setName] = useState(sessionName);
  const [saving, setSaving] = useState(false);

  useUnsavedChangesGuard(name !== sessionName);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast("表示名を入力してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ name: trimmed }).eq("id", userId);
    setSaving(false);
    if (error) {
      toast(`保存に失敗しました: ${error.message}`);
      return;
    }
    toast("表示名を更新しました");
    router.push("/settings");
    router.refresh();
  }

  return (
    <PageShell header={<AppHeader title="表示名の変更" variant="detail" backHref="/settings" />}>
      <SectionLabel>表示名</SectionLabel>
      <Card>
        <FieldLabel>表示名</FieldLabel>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass()} />
        <SubmitButton onClick={handleSave} disabled={saving}>
          {saving ? "保存中…" : "保存する"}
        </SubmitButton>
      </Card>
    </PageShell>
  );
}
