"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { Card, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { canManagePracticeMenus } from "@/lib/permissions";
import type { PracticeMenu } from "@/lib/database.types";

export function PracticeMenuCard({ scheduleId }: { scheduleId: string }) {
  const { teamId, userId, role } = useSession();
  const toast = useToast();
  const canManage = canManagePracticeMenus(role);

  const [menu, setMenu] = useState<PracticeMenu | null>(null);
  const [theme, setTheme] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("practice_menus")
      .select("*")
      .eq("schedule_id", scheduleId)
      .maybeSingle();
    setMenu(data ?? null);
    setTheme(data?.theme ?? "");
    setLoading(false);
  }, [scheduleId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("practice_menus")
      .upsert(
        {
          team_id: teamId,
          schedule_id: scheduleId,
          theme: theme.trim() || null,
          created_by: userId,
        },
        { onConflict: "schedule_id" },
      )
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast(`保存に失敗しました: ${error.message}`);
      return;
    }
    setMenu(data);
    toast("練習メニューを保存しました");
  }

  if (loading) return null;
  if (!canManage && !menu?.theme) return null;

  return (
    <>
      <SectionLabel>練習メニュー</SectionLabel>
      <Card>
        {canManage ? (
          <>
            <FieldLabel>タイトル</FieldLabel>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className={inputClass()}
              placeholder="例: シュート強化"
            />
            <SubmitButton onClick={handleSave} disabled={saving}>
              {saving ? "保存中…" : "保存する"}
            </SubmitButton>
          </>
        ) : (
          <div className="font-bold text-[13.5px]">{menu?.theme}</div>
        )}
      </Card>
    </>
  );
}
