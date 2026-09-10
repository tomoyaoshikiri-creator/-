"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, SectionLabel } from "@/components/ui/Card";
import { canManageSettings } from "@/lib/permissions";

const EXPORT_ITEMS: { type: string; label: string; desc: string }[] = [
  { type: "players", label: "選手一覧", desc: "選手名簿(氏名・学年・ポジション・在籍状況など)" },
  { type: "schedules", label: "予定一覧", desc: "練習・試合・イベントの予定" },
  { type: "attendances", label: "出欠記録", desc: "予定ごとの選手の出欠状況" },
  { type: "games", label: "試合結果", desc: "試合ごとの対戦相手・得点" },
  { type: "daily_reports", label: "チーム日報", desc: "日々のチーム日報" },
  { type: "notices", label: "お知らせ", desc: "チームに配信したお知らせ" },
];

export default function DataExportPage() {
  const router = useRouter();
  const { role } = useSession();

  useEffect(() => {
    if (!canManageSettings(role)) router.replace("/settings");
  }, [role, router]);

  return (
    <PageShell header={<AppHeader title="データをエクスポート" variant="detail" backHref="/settings" accessBadge="admin" />}>
      <SectionLabel>CSVでダウンロード</SectionLabel>
      <Card>
        <div className="text-[12px] text-ink-soft mb-3">
          チームのデータをCSVファイルでダウンロードできます。項目ごとに個別のファイルになります。
        </div>
        <div className="flex flex-col gap-2">
          {EXPORT_ITEMS.map((item) => (
            <a
              key={item.type}
              href={`/api/export/${item.type}`}
              className="flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-2.5 active:opacity-80"
            >
              <div>
                <div className="font-bold text-[12.5px]">{item.label}</div>
                <div className="text-[11px] text-ink-soft mt-0.5">{item.desc}</div>
              </div>
              <div className="text-[11px] text-orange font-bold flex-none ml-2">CSV ›</div>
            </a>
          ))}
        </div>
      </Card>
    </PageShell>
  );
}
