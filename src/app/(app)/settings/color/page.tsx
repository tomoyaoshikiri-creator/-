"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SubmitButton } from "@/components/ui/SegButton";
import { canManageSettings } from "@/lib/permissions";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";

const DEFAULT_PRIMARY = "#9c8355";
const DEFAULT_ACCENT = "#22201c";

export default function SettingsColorPage() {
  const router = useRouter();
  const { role, teamId } = useSession();
  const toast = useToast();

  const [primary, setPrimary] = useState(DEFAULT_PRIMARY);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [savedPrimary, setSavedPrimary] = useState(DEFAULT_PRIMARY);
  const [savedAccent, setSavedAccent] = useState(DEFAULT_ACCENT);
  const [customized, setCustomized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useUnsavedChangesGuard(!loading && (primary !== savedPrimary || accent !== savedAccent));

  useEffect(() => {
    if (!canManageSettings(role)) {
      router.replace("/settings");
    }
  }, [role, router]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("teams")
        .select("theme_primary, theme_accent")
        .eq("id", teamId)
        .single();
      if (data?.theme_primary || data?.theme_accent) {
        setCustomized(true);
        setPrimary(data.theme_primary ?? DEFAULT_PRIMARY);
        setAccent(data.theme_accent ?? DEFAULT_ACCENT);
        setSavedPrimary(data.theme_primary ?? DEFAULT_PRIMARY);
        setSavedAccent(data.theme_accent ?? DEFAULT_ACCENT);
      }
      setLoading(false);
    })();
  }, [teamId]);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("teams")
      .update({ theme_primary: primary, theme_accent: accent })
      .eq("id", teamId);
    setSaving(false);
    if (error) {
      toast(`保存に失敗しました: ${error.message}`);
      return;
    }
    setCustomized(true);
    setSavedPrimary(primary);
    setSavedAccent(accent);
    toast("配色を保存しました");
    router.refresh();
  }

  async function handleReset() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("teams")
      .update({ theme_primary: null, theme_accent: null })
      .eq("id", teamId);
    setSaving(false);
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }
    setCustomized(false);
    setPrimary(DEFAULT_PRIMARY);
    setAccent(DEFAULT_ACCENT);
    setSavedPrimary(DEFAULT_PRIMARY);
    setSavedAccent(DEFAULT_ACCENT);
    toast("デフォルトの配色に戻しました");
    router.refresh();
  }

  return (
    <PageShell header={<AppHeader title="配色" variant="detail" backHref="/settings" accessBadge="admin" />}>
      <SectionLabel>配色</SectionLabel>
      {loading ? (
        <div className="text-[12.5px] text-ink-soft text-center py-5">読み込み中…</div>
      ) : (
        <Card>
          <div className="text-xs text-ink-soft mb-4">
            {customized
              ? "このチーム専用の配色を使っています。"
              : "現在はアプリ標準の配色です。チームのブランドカラーに変更できます。"}
          </div>

          <FieldLabel>基調色(タブの見出し・強調表示など画面全体に使用)</FieldLabel>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              className="w-12 h-10 rounded-lg border border-line bg-white"
            />
            <input
              type="text"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              className="flex-1 border border-line rounded-[10px] px-2.5 py-2 font-mono text-[13px] bg-white text-ink"
            />
          </div>

          <div className="mt-4">
            <FieldLabel>アクセントカラー(詳細画面の見出し・ボタンに使用)</FieldLabel>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="w-12 h-10 rounded-lg border border-line bg-white"
              />
              <input
                type="text"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="flex-1 border border-line rounded-[10px] px-2.5 py-2 font-mono text-[13px] bg-white text-ink"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2 items-center">
            <span
              className="inline-block px-3 py-1.5 rounded-lg text-white text-xs font-bold"
              style={{ backgroundColor: primary }}
            >
              基調色
            </span>
            <span
              className="inline-block px-3 py-1.5 rounded-lg text-white text-xs font-bold"
              style={{ backgroundColor: accent }}
            >
              アクセント
            </span>
          </div>

          <SubmitButton onClick={handleSave} disabled={saving}>
            {saving ? "保存中…" : "この配色を保存する"}
          </SubmitButton>

          {customized && (
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="w-full mt-2.5 text-center py-2 rounded-[10px] font-bold text-[12.5px] border border-line bg-white text-ink-soft"
            >
              デフォルトの配色に戻す
            </button>
          )}
        </Card>
      )}
    </PageShell>
  );
}
