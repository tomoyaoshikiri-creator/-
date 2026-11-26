"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { SectionLabel, cardClass, EmptyState } from "@/components/ui/Card";
import { FieldLabel, SubmitButton } from "@/components/ui/SegButton";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { MonthDaySelect } from "@/components/ui/MonthDaySelect";
import { canSetBirthday } from "@/lib/permissions";

// 選手以外(指導者等)のメンバーも、自分の誕生日を登録できるようにする画面。年は
// 登録せず月日のみ(DB上は固定のうるう年を仮の年として保存し、表示側では常にMM-DD
// 部分だけを使う。選手のbirthdayと同じ扱い)。誕生日の登録は指導者・管理者のみ
// (ユーザー指示)のため、それ以外のロールは/settingsへ戻す。
export default function SettingsBirthdayPage() {
  const router = useRouter();
  const { userId, role } = useSession();
  const toast = useToast();
  const [monthDay, setMonthDay] = useState("");
  const [initial, setInitial] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canSetBirthday(role)) router.replace("/settings");
  }, [role, router]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("profiles").select("birthday").eq("id", userId).maybeSingle();
      const monthDayValue = data?.birthday ? data.birthday.slice(5, 10) : "";
      setMonthDay(monthDayValue);
      setInitial(monthDayValue);
      setLoading(false);
    })();
  }, [userId]);

  useUnsavedChangesGuard(initial !== null && monthDay !== initial);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ birthday: monthDay ? `2000-${monthDay}` : null })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error(`保存に失敗しました: ${error.message}`);
      return;
    }
    toast.success("誕生日を更新しました");
    router.push("/settings");
    router.refresh();
  }

  return (
    <PageShell header={<AppHeader title="誕生日の登録" variant="detail" backHref="/settings" />}>
      <SectionLabel>誕生日(月日のみ)</SectionLabel>
      <div className={cardClass}>
        {loading ? (
          <EmptyState>読み込み中…</EmptyState>
        ) : (
          <>
            <FieldLabel>誕生日</FieldLabel>
            <MonthDaySelect value={monthDay} onChange={setMonthDay} />
            <div className="text-xs text-ink-soft mt-2">
              年は登録されません。登録すると、誕生日当日にチームの「今日の誕生日」等に表示されます。
            </div>
            <SubmitButton onClick={handleSave} disabled={saving}>
              {saving ? "保存中…" : "保存する"}
            </SubmitButton>
          </>
        )}
      </div>
    </PageShell>
  );
}
