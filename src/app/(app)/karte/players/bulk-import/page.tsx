"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SegButton";
import { canManagePlayers } from "@/lib/permissions";
import { hasBulkImportAccess } from "@/lib/plan";
import { decodeCsvFile, toCsv } from "@/lib/csv";
import { PLAYER_IMPORT_HEADERS } from "@/lib/playerImport";

interface RowResult {
  rowNumber: number;
  input: { sei: string; mei: string };
  errors: string[];
}

interface ImportResponse {
  dryRun: boolean;
  results: RowResult[];
  total: number;
  validCount: number;
  errorCount: number;
  insertedCount?: number;
  error?: string;
}

function downloadTemplate() {
  const csv = toCsv(PLAYER_IMPORT_HEADERS, [["山田", "太郎", "ヤマダ", "タロウ", "3年", "10", "PG", "2015-04-01"]]);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "players_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function PlayerBulkImportPage() {
  const router = useRouter();
  const { role, plan } = useSession();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!canManagePlayers(role) || !hasBulkImportAccess(plan)) router.replace("/karte/players");
  }, [role, plan, router]);

  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [mojibakeWarning, setMojibakeWarning] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function handleFileSelected(file: File) {
    setResult(null);
    setConfirmed(false);
    const buffer = await file.arrayBuffer();
    const { text, mojibakeSuspected } = decodeCsvFile(buffer);
    setFileName(file.name);
    setCsvText(text);
    setMojibakeWarning(mojibakeSuspected);
  }

  async function handleDryRun() {
    if (!csvText) return;
    setChecking(true);
    try {
      const res = await fetch("/api/players/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, dryRun: true }),
      });
      const json: ImportResponse = await res.json();
      if (!res.ok) {
        toast(json.error ?? "確認に失敗しました");
        return;
      }
      setResult(json);
    } catch {
      toast("確認に失敗しました");
    } finally {
      setChecking(false);
    }
  }

  async function handleConfirm() {
    if (!csvText) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/players/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, dryRun: false }),
      });
      const json: ImportResponse = await res.json();
      if (!res.ok) {
        toast(json.error ?? "登録に失敗しました");
        return;
      }
      setResult(json);
      setConfirmed(true);
      toast(`${json.insertedCount ?? 0}件登録しました`);
    } catch {
      toast("登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  const errorRows = result?.results.filter((r) => r.errors.length > 0) ?? [];

  return (
    <PageShell header={<AppHeader title="選手のCSV一括登録" variant="detail" backHref="/karte/players" accessBadge="coach" />}>
      <SectionLabel>①テンプレートをダウンロード</SectionLabel>
      <Card>
        <div className="text-[12px] text-ink-soft mb-2.5">
          テンプレートの列に合わせて選手情報を入力してください。氏・名以外は空欄でも登録できます。
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="w-full text-center py-2.5 rounded-lg font-bold text-[12.5px] border border-line bg-paper text-ink-soft"
        >
          テンプレートCSVをダウンロード
        </button>
      </Card>

      <SectionLabel>②CSVをアップロード</SectionLabel>
      <Card>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelected(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full text-center py-2.5 rounded-lg font-bold text-[12.5px] border border-orange text-orange bg-orange/8"
        >
          📎 CSVファイルを選ぶ
        </button>
        {fileName && <div className="text-[11.5px] text-ink-soft mt-2">選択中: {fileName}</div>}
        {mojibakeWarning && (
          <div className="text-[11px] mt-2" style={{ color: "var(--danger)" }}>
            文字化けしている可能性があります。Excelで保存する際は「CSV UTF-8」形式をお試しください。
          </div>
        )}
      </Card>

      {csvText && (
        <>
          <SectionLabel>③内容を確認(ドライラン)</SectionLabel>
          <Card>
            <SubmitButton onClick={handleDryRun} disabled={checking}>
              {checking ? "確認中…" : "この内容で確認する"}
            </SubmitButton>
          </Card>
        </>
      )}

      {result && (
        <>
          <SectionLabel>確認結果</SectionLabel>
          <Card>
            <div className="text-[13px] font-bold mb-1">
              対象{result.total}件中、正常{result.validCount}件・エラー{result.errorCount}件
            </div>
            {confirmed && (
              <div className="text-[12.5px] font-bold mt-1" style={{ color: "var(--orange)" }}>
                {result.insertedCount}件を登録しました。
              </div>
            )}
          </Card>

          {errorRows.length > 0 && (
            <Card className="max-h-[50vh] overflow-y-auto">
              {errorRows.map((r) => (
                <div key={r.rowNumber} className="border-b border-line last:border-b-0 py-2 text-[11.5px]">
                  <div className="font-bold">
                    {r.rowNumber}行目: {r.input.sei} {r.input.mei}
                  </div>
                  <ul className="list-disc pl-4 mt-1" style={{ color: "var(--danger)" }}>
                    {r.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </Card>
          )}

          {!confirmed && (
            <>
              <SectionLabel>④確定して登録</SectionLabel>
              <Card>
                <div className="text-[11.5px] text-ink-soft mb-2.5">
                  エラーのある行を除いた{result.validCount}件を登録します。エラー行は登録されません。
                </div>
                <SubmitButton onClick={handleConfirm} disabled={submitting || result.validCount === 0}>
                  {submitting ? "登録中…" : `${result.validCount}件を登録する`}
                </SubmitButton>
              </Card>
            </>
          )}
        </>
      )}

      {!csvText && <EmptyState>CSVファイルを選んでください</EmptyState>}
    </PageShell>
  );
}
