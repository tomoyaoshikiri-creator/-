"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, SectionLabel } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { canManageAccounting } from "@/lib/permissions";
import { hasAccountingAccess } from "@/lib/plan";

// 会計機能のハブ画面(フェーズ1)。一般(保護者)向けの会計報告閲覧はフェーズ3で追加する。
export default function AccountingHubPage() {
  const router = useRouter();
  const { role, plan } = useSession();

  useEffect(() => {
    if (!canManageAccounting(role) || !hasAccountingAccess(plan)) router.replace("/team");
  }, [role, plan, router]);

  return (
    <PageShell header={<AppHeader title="会計" variant="list" backHref="/team" accessBadge="operations" />}>
      <SectionLabel>予算・項目</SectionLabel>
      <Link href="/accounting/budget">
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px]">予算案</div>
              <div className="text-[11.5px] text-ink-soft mt-1">年度ごとに項目別の予算額・備考を登録する</div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </Card>
      </Link>
      <Link href="/accounting/categories">
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px]">項目の管理</div>
              <div className="text-[11.5px] text-ink-soft mt-1">収入・支出の項目を追加・編集・並べ替えする</div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </Card>
      </Link>

      <SectionLabel>入出金</SectionLabel>
      <Link href="/accounting/transactions">
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px]">入出金を記録・確認する</div>
              <div className="text-[11.5px] text-ink-soft mt-1">日付・項目・金額で入出金を記録し、明細を見る</div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </Card>
      </Link>

      <SectionLabel>会計報告</SectionLabel>
      <Link href="/accounting/report">
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px]">会計報告・予算案を出力する</div>
              <div className="text-[11.5px] text-ink-soft mt-1">予算額・決算額・差異をまとめて印刷・PDF保存する</div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </Card>
      </Link>

      <SectionLabel>担当者</SectionLabel>
      <Link href="/accounting/officers">
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px]">会計担当・会計監査</div>
              <div className="text-[11.5px] text-ink-soft mt-1">会計報告の承認者を指定する</div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </Card>
      </Link>
    </PageShell>
  );
}
