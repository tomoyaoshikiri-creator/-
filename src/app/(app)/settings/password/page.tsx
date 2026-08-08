"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";

export default function SettingsPasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (newPassword.length < 8) {
      toast("パスワードは8文字以上で入力してください");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("確認用パスワードが一致しません");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) {
      toast(`変更に失敗しました: ${error.message}`);
      return;
    }
    toast("パスワードを変更しました");
    router.push("/settings");
  }

  return (
    <PageShell header={<AppHeader title="パスワードの変更" variant="detail" backHref="/settings" />}>
      <SectionLabel>新しいパスワード</SectionLabel>
      <Card>
        <FieldLabel>新しいパスワード</FieldLabel>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass()}
        />
        <div className="mt-3">
          <FieldLabel>新しいパスワード(確認)</FieldLabel>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass()}
          />
        </div>
        <SubmitButton onClick={handleSave} disabled={saving}>
          {saving ? "変更中…" : "パスワードを変更する"}
        </SubmitButton>
      </Card>
    </PageShell>
  );
}
