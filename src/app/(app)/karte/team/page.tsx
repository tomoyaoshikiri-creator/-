"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { canViewKarte } from "@/lib/permissions";
import { hasAiAnalysisAccess, hasKarteTabAccess } from "@/lib/plan";
import { usesDetailedBasketballStats } from "@/lib/sport";

export default function KarteTeamPage() {
  const router = useRouter();
  const { role, plan, sport, teamGoal } = useSession();
  const showBasketballStats = usesDetailedBasketballStats(sport);
  const isStaff = canViewKarte(role);

  useEffect(() => {
    if (!hasKarteTabAccess(plan)) router.replace("/team");
  }, [plan, router]);

  return (
    <PageShell
      header={
        <AppHeader title="チームカルテ" variant="detail" backHref="/team" accessBadge={isStaff ? "coach" : undefined} />
      }
    >
      {role === "管理者" && (
        <Link href="/karte/team/goal">
          <Card className="cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-[15px]">チーム目標</div>
                <div className="text-[11.5px] text-ink-soft mt-1">
                  {teamGoal ? teamGoal : "未設定(ホーム画面に表示されません)"}
                </div>
              </div>
              <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
            </div>
          </Card>
        </Link>
      )}

      <Link href="/game">
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px]">試合記録</div>
              <div className="text-[11.5px] text-ink-soft mt-1">試合結果・記録を見る</div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </Card>
      </Link>

      <Link href={showBasketballStats ? "/karte/team/game" : "/karte/team/custom-stats"}>
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px]">スタッツ</div>
              <div className="text-[11.5px] text-ink-soft mt-1">
                {isStaff ? "選手ごとの試合スタッツ" : "チーム平均の試合スタッツ"}
              </div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </Card>
      </Link>

      {isStaff && (
        <Link href="/karte/team/workout">
          <Card className="cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-[15px]">ワークアウト</div>
                <div className="text-[11.5px] text-ink-soft mt-1">いつどんな練習をしたかの履歴</div>
              </div>
              <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
            </div>
          </Card>
        </Link>
      )}

      {isStaff && hasAiAnalysisAccess(plan) && (
        <Link href="/karte/team/analysis">
          <Card className="cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-[15px]">チーム分析</div>
                <div className="text-[11.5px] text-ink-soft mt-1">AI分析・フィードバック・分析用データ抽出</div>
              </div>
              <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
            </div>
          </Card>
        </Link>
      )}
    </PageShell>
  );
}
