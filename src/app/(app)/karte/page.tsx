"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { canViewKarte } from "@/lib/permissions";
import { computeTeamAnalysisUnseen, computeUnseenPlayerAnalysisIds, computeUnseenPlayerNoteIds } from "@/lib/itemBadges";

export default function KarteTopPage() {
  const { role, userId, teamId } = useSession();
  const isStaff = canViewKarte(role);
  const [teamAnalysisUnseen, setTeamAnalysisUnseen] = useState(false);
  const [playerAnalysisUnseen, setPlayerAnalysisUnseen] = useState(false);
  const [playerNotesUnseen, setPlayerNotesUnseen] = useState(false);

  useEffect(() => {
    if (isStaff) {
      computeTeamAnalysisUnseen(userId, teamId).then(setTeamAnalysisUnseen);
      computeUnseenPlayerAnalysisIds(userId).then((ids) => setPlayerAnalysisUnseen(ids.size > 0));
    }
    computeUnseenPlayerNoteIds(userId).then((ids) => setPlayerNotesUnseen(ids.size > 0));
  }, [isStaff, userId, teamId]);

  return (
    <PageShell header={<AppHeader title="カルテ" accessBadge={isStaff ? "coach" : undefined} />}>
      <Link href="/karte/team">
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px] flex items-center gap-1.5">
                {teamAnalysisUnseen && <span className="w-[7px] h-[7px] rounded-full bg-danger flex-shrink-0" />}
                チームカルテ
              </div>
              <div className="text-[11.5px] text-ink-soft mt-1">
                {isStaff ? "項目別ランキングでチーム全体を見る・分析する" : "試合記録・チーム平均のスタッツ・スポーツテストを見る"}
              </div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </Card>
      </Link>

      {isStaff && (
        <>
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
        </>
      )}

      <Link href="/players">
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px] flex items-center gap-1.5">
                {playerNotesUnseen && <span className="w-[7px] h-[7px] rounded-full bg-danger flex-shrink-0" />}
                選手一覧
              </div>
              <div className="text-[11.5px] text-ink-soft mt-1">選手の基本情報・成長記録・メモを見る</div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </Card>
      </Link>
    </PageShell>
  );
}
