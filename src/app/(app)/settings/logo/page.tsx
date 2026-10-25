"use client";

import { useEffect, useRef, useState } from "react";
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
import { teamLogoUrl } from "@/lib/teamLogo";

export default function SettingsLogoPage() {
  const router = useRouter();
  const { role, teamId } = useSession();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [savedTeamName, setSavedTeamName] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingName, setSavingName] = useState(false);
  // デフォルトは読み取り専用、「編集」をタップしたときだけ入力欄を表示する
  // (他の設定画面と揃えたユーザー指示)。
  const [editingName, setEditingName] = useState(false);

  useUnsavedChangesGuard(!loading && teamName !== savedTeamName);

  useEffect(() => {
    if (!canManageSettings(role)) {
      router.replace("/settings");
    }
  }, [role, router]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("teams").select("logo_path, name").eq("id", teamId).single();
      setLogoUrl(teamLogoUrl(supabase, data?.logo_path));
      setTeamName(data?.name ?? "");
      setSavedTeamName(data?.name ?? "");
      setLoading(false);
    })();
  }, [teamId]);

  async function handleSaveName() {
    const trimmed = teamName.trim();
    if (!trimmed) {
      toast.warning("チーム名を入力してください");
      return;
    }
    setSavingName(true);
    const supabase = createClient();
    const { error } = await supabase.from("teams").update({ name: trimmed }).eq("id", teamId);
    setSavingName(false);
    if (error) {
      toast.error(`保存に失敗しました: ${error.message}`);
      return;
    }
    setTeamName(trimmed);
    setSavedTeamName(trimmed);
    setEditingName(false);
    toast.success("チーム名を更新しました");
    router.refresh();
  }

  async function handleLogoChange(file: File | undefined) {
    if (!file) return;
    if (/\.(heic|heif)$/i.test(file.name)) {
      toast.warning("HEIC形式の画像はブラウザで表示できません。PNGかJPEGを選んでください。");
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/team/logo", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      toast.error(`アップロードに失敗しました: ${data.error ?? ""}`);
      return;
    }
    const supabase = createClient();
    setLogoUrl(teamLogoUrl(supabase, data.path));
    toast.success("ロゴを更新しました");
    router.refresh();
  }

  async function handleLogoRemove() {
    setUploading(true);
    const supabase = createClient();
    const { error } = await supabase.from("teams").update({ logo_path: null }).eq("id", teamId);
    setUploading(false);
    if (error) {
      toast.error(`更新に失敗しました: ${error.message}`);
      return;
    }
    setLogoUrl(null);
    toast.success("ロゴを削除しました");
    router.refresh();
  }

  return (
    <PageShell header={<AppHeader title="チーム情報・表示設定" variant="detail" backHref="/settings/team" accessBadge="admin" />}>
      <SectionLabel>ロゴ</SectionLabel>
      {loading ? (
        <div className="text-[12.5px] text-ink-soft text-center py-5">読み込み中…</div>
      ) : (
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg border border-line bg-paper flex items-center justify-center overflow-hidden flex-shrink-0">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="チームロゴ" className="w-full h-full object-contain" />
              ) : (
                <span className="text-[10px] text-ink-soft text-center">未設定</span>
              )}
            </div>
            <div className="flex-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-3 py-2 rounded-lg text-[12.5px] font-bold border border-line bg-paper text-ink-soft"
              >
                {uploading ? "処理中…" : "画像を選ぶ"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handleLogoChange(e.target.files?.[0])}
              />
              {logoUrl && (
                <button
                  type="button"
                  onClick={handleLogoRemove}
                  disabled={uploading}
                  className="ml-2 px-3 py-2 rounded-lg text-[12.5px] font-bold border border-line bg-white text-ink-soft"
                >
                  削除
                </button>
              )}
              <div className="text-xs text-ink-soft mt-2">
                アプリ内のヘッダー・サイドバー・ハンバーガーメニューに表示されます(正方形に近い画像がきれいに収まります)。
              </div>
            </div>
          </div>
        </Card>
      )}

      <SectionLabel>チーム名の表示</SectionLabel>
      {loading ? (
        <div className="text-[12.5px] text-ink-soft text-center py-5">読み込み中…</div>
      ) : (
        <Card>
          {editingName ? (
            <>
              <FieldLabel>チーム名</FieldLabel>
              <input value={teamName} onChange={(e) => setTeamName(e.target.value)} className={inputClass()} />
              <div className="text-xs text-ink-soft mt-2">アプリ内のヘッダーなど、画面各所に表示されます。</div>
              <SubmitButton onClick={handleSaveName} disabled={savingName}>
                {savingName ? "保存中…" : "保存する"}
              </SubmitButton>
            </>
          ) : (
            <>
              <div className="text-[14px] font-bold">{teamName}</div>
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="w-full mt-3 text-center py-2.5 rounded-lg font-bold text-[13px] border border-orange text-orange-text bg-orange/8"
              >
                チーム名を編集する
              </button>
            </>
          )}
        </Card>
      )}
    </PageShell>
  );
}
