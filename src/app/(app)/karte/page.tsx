"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { canViewKarte } from "@/lib/permissions";
import { computeTeamAnalysisUnseen, computeUnseenPlayerAnalysisIds } from "@/lib/itemBadges";

export default function KarteTopPage() {
  const router = useRouter();
  const { role, userId, teamId } = useSession();
  const [teamAnalysisUnseen, setTeamAnalysisUnseen] = useState(false);
  const [playerAnalysisUnseen, setPlayerAnalysisUnseen] = useState(false);

  useEffect(() => {
    if (!canViewKarte(role)) router.replace("/schedule");
  }, [role, router]);

  useEffect(() => {
    computeTeamAnalysisUnseen(userId, teamId).then(setTeamAnalysisUnseen);
    computeUnseenPlayerAnalysisIds(userId).then((ids) => setPlayerAnalysisUnseen(ids.size > 0));
  }, [userId, teamId]);

  return (
    <PageShell header={<AppHeader title="カルテ" accessBadge="coach" />}>
      <Link href="/karte/team">
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px] flex items-center gap-1.5">
                {teamAnalysisUnseen && <span className="w-[7px] h-[7px] rounded-full bg-danger flex-shrink-0" />}
                チームカルテ
              </div>
              <div className="text-[11.5px] text-ink-soft mt-1">項目別ランキングでチーム全体を見る・分析する</div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </Card>
      </Link>

      <Link href="/karte/players">
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px] flex items-center gap-1.5">
                {playerAnalysisUnseen && <span className="w-[7px] h-[7px] rounded-full bg-danger flex-shrink-0" />}
                選手カルテ
              </div>
              <div className="text-[11.5px] text-ink-soft mt-1">選手ごとにスタッツ・スポーツテストを見る・分析する</div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </Card>
      </Link>
    </PageShell>
  );
}
