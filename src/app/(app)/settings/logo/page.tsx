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
import { teamLogoUrl } from "@/lib/teamLogo";
import { safeExt } from "@/lib/storagePath";

export default function SettingsLogoPage() {
  const router = useRouter();
  const { role, teamId } = useSession();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [slug, setSlug] = useState("");
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!canManageSettings(role)) {
      router.replace("/settings");
    }
  }, [role, router]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("teams").select("logo_path, name, slug").eq("id", teamId).single();
      setLogoUrl(teamLogoUrl(supabase, data?.logo_path));
      setTeamName(data?.name ?? "");
      setSlug(data?.slug ?? "");
      setLoading(false);
    })();
  }, [teamId]);

  async function handleSaveName() {
    const trimmed = teamName.trim();
    if (!trimmed) {
      toast("チーム名を入力してください");
      return;
    }
    setSavingName(true);
    const supabase = createClient();
    const { error } = await supabase.from("teams").update({ name: trimmed }).eq("id", teamId);
    setSavingName(false);
    if (error) {
      toast(`保存に失敗しました: ${error.message}`);
      return;
    }
    setTeamName(trimmed);
    toast("チーム名を更新しました");
    router.refresh();
  }

  function copyLoginUrl() {
    navigator.clipboard?.writeText(`${origin}/login/${slug}`);
    toast("リンクをコピーしました");
  }

  async function handleLogoChange(file: File | undefined) {
    if (!file) return;
    if (/\.(heic|heif)$/i.test(file.name)) {
      toast("HEIC形式の画像はブラウザで表示できません。PNGかJPEGを選んでください。");
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const path = `${teamId}/logo-${Date.now()}.${safeExt(file.name)}`;
    const { error: uploadError } = await supabase.storage.from("team-logos").upload(path, file);
    if (uploadError) {
      setUploading(false);
      toast(`アップロードに失敗しました: ${uploadError.message}`);
      return;
    }
    const { error } = await supabase.from("teams").update({ logo_path: path }).eq("id", teamId);
    setUploading(false);
    if (error) {
      toast(`保存に失敗しました: ${error.message}`);
      return;
    }
    setLogoUrl(teamLogoUrl(supabase, path));
    toast("ロゴを更新しました");
    router.refresh();
  }

  async function handleLogoRemove() {
    setUploading(true);
    const supabase = createClient();
    const { error } = await supabase.from("teams").update({ logo_path: null }).eq("id", teamId);
    setUploading(false);
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }
    setLogoUrl(null);
    toast("ロゴを削除しました");
    router.refresh();
  }

  return (
    <PageShell header={<AppHeader title="ログイン画面" variant="detail" backHref="/settings" accessBadge="admin" />}>
      <SectionLabel>ロゴ</SectionLabel>
      {loading ? (
        <div className="text-[12.5px] text-ink-soft text-center py-5">読み込み中…</div>
      ) : (
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl border border-line bg-paper flex items-center justify-center overflow-hidden flex-shrink-0">
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
                className="px-3 py-2 rounded-[10px] text-[12.5px] font-bold border border-line bg-paper text-ink-soft"
              >
                {uploading ? "処理中…" : "画像を選ぶ"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => handleLogoChange(e.target.files?.[0])}
              />
              {logoUrl && (
                <button
                  type="button"
                  onClick={handleLogoRemove}
                  disabled={uploading}
                  className="ml-2 px-3 py-2 rounded-[10px] text-[12.5px] font-bold border border-line bg-white text-ink-soft"
                >
                  削除
                </button>
              )}
              <div className="text-xs text-ink-soft mt-2">
                アプリ内のヘッダーと、ホーム画面に追加した際のアイコンの両方に使われます(正方形に近い画像がきれいに収まります)。
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
          <FieldLabel>チーム名</FieldLabel>
          <input value={teamName} onChange={(e) => setTeamName(e.target.value)} className={inputClass()} />
          <div className="text-xs text-ink-soft mt-2">
            下記のチーム専用ログインURLからアクセスした際、ロゴと一緒に表示されます。
          </div>
          <SubmitButton onClick={handleSaveName} disabled={savingName}>
            {savingName ? "保存中…" : "保存する"}
          </SubmitButton>
        </Card>
      )}

      <SectionLabel>チーム専用ログインURL</SectionLabel>
      {loading ? (
        <div className="text-[12.5px] text-ink-soft text-center py-5">読み込み中…</div>
      ) : (
        <Card>
          <div className="flex items-center gap-2">
            <input readOnly className={inputClass("text-[11px]")} value={`${origin}/login/${slug}`} />
            <button type="button" onClick={copyLoginUrl} className="flex-none text-orange font-bold text-xs">
              コピー
            </button>
          </div>
          <div className="text-xs text-ink-soft mt-2">
            このURLからアクセスすると、上記のロゴとチーム名が表示されたログイン画面になります。共通の「Club
            Link」ログイン画面(/login)には影響しません。
          </div>
        </Card>
      )}
    </PageShell>
  );
}
