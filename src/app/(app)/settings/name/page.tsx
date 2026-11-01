"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { SectionLabel, cardClass } from "@/components/ui/Card";
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
      toast.warning("表示名を入力してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ name: trimmed }).eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error(`保存に失敗しました: ${error.message}`);
      return;
    }
    toast.success("表示名を更新しました");
    router.push("/settings");
    router.refresh();
  }

  return (
    <PageShell header={<AppHeader title="表示名の変更" variant="detail" backHref="/settings" />}>
      <SectionLabel>表示名</SectionLabel>
      <div className={cardClass}>
        <FieldLabel htmlFor="settings-name">表示名</FieldLabel>
        <input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass()} />
        <SubmitButton onClick={handleSave} disabled={saving}>
          {saving ? "保存中…" : "保存する"}
        </SubmitButton>
      </div>
    </PageShell>
  );
}
