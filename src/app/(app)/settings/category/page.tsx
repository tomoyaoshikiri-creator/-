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
import { canManageSettings } from "@/lib/permissions";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { SPORTS, SPORT_DISPLAY_LABELS } from "@/lib/sport";
import { CATEGORIES, CATEGORY_DISPLAY_LABELS, isMiniBasketballAllowed } from "@/lib/category";
import type { TeamCategory, TeamSport } from "@/lib/database.types";

export default function SettingsCategoryPage() {
  const router = useRouter();
  const { role, teamId } = useSession();
  const toast = useToast();

  const [category, setCategory] = useState<TeamCategory>("小学生");
  const [sport, setSport] = useState<TeamSport>("ミニバスケットボール");
  const [savedCategory, setSavedCategory] = useState<TeamCategory>("小学生");
  const [savedSport, setSavedSport] = useState<TeamSport>("ミニバスケットボール");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const availableSports = SPORTS.filter((s) => s !== "ミニバスケットボール" || isMiniBasketballAllowed(category));

  useUnsavedChangesGuard(!loading && (category !== savedCategory || sport !== savedSport));

  useEffect(() => {
    if (!canManageSettings(role)) {
      router.replace("/settings");
    }
  }, [role, router]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("teams").select("category, sport").eq("id", teamId).single();
      if (data) {
        setCategory(data.category);
        setSport(data.sport);
        setSavedCategory(data.category);
        setSavedSport(data.sport);
      }
      setLoading(false);
    })();
  }, [teamId]);

  function handleCategoryChange(next: TeamCategory) {
    setCategory(next);
    if (sport === "ミニバスケットボール" && !isMiniBasketballAllowed(next)) {
      setSport("バスケットボール");
      toast("ミニバスケットボールは小学生カテゴリー専用のため、競技をバスケットボールに変更しました");
    }
  }

  async function handleSave() {
    // 万一クライアント側の自動調整が効かなかった場合でも、DBのCHECK制約に
    // 弾かれないよう保存直前にもう一度整合させる。
    const sportToSave = sport === "ミニバスケットボール" && !isMiniBasketballAllowed(category) ? "バスケットボール" : sport;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("teams").update({ category, sport: sportToSave }).eq("id", teamId);
    setSaving(false);
    if (error) {
      toast(`保存に失敗しました: ${error.message}`);
      return;
    }
    setSport(sportToSave);
    setSavedCategory(category);
    setSavedSport(sportToSave);
    toast("カテゴリーを保存しました");
    router.refresh();
  }

  return (
    <PageShell header={<AppHeader title="カテゴリー" variant="detail" backHref="/settings" accessBadge="admin" />}>
      <SectionLabel>カテゴリー・競技</SectionLabel>
      {loading ? (
        <div className="text-[12.5px] text-ink-soft text-center py-5">読み込み中…</div>
      ) : (
        <Card>
          <div className="text-xs text-ink-soft mb-4">
            チームの年代カテゴリーです。カテゴリーを変更しても、既に登録済みの選手の学年は自動的には変わりません(範囲外になった場合は選手ごとに個別編集してください)。
          </div>

          <FieldLabel>カテゴリー</FieldLabel>
          <select
            className={inputClass()}
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value as TeamCategory)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_DISPLAY_LABELS[c]}
              </option>
            ))}
          </select>

          <div className="mt-3">
            <FieldLabel>競技</FieldLabel>
            <select className={inputClass()} value={sport} onChange={(e) => setSport(e.target.value as TeamSport)}>
              {availableSports.map((s) => (
                <option key={s} value={s}>
                  {SPORT_DISPLAY_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <SubmitButton onClick={handleSave} disabled={saving}>
            {saving ? "保存中…" : "保存する"}
          </SubmitButton>
        </Card>
      )}
    </PageShell>
  );
}
