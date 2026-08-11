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

export default function KarteTeamPage() {
  const router = useRouter();
  const { role } = useSession();

  useEffect(() => {
    if (!canViewKarte(role)) router.replace("/schedule");
  }, [role, router]);

  return (
    <PageShell header={<AppHeader title="チームカルテ" variant="detail" backHref="/karte" accessBadge="coach" />}>
      <Link href="/game">
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px]">試合記録</div>
              <div className="text-[11.5px] text-ink-soft mt-1">試合結果・スタメン記録を見る</div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </Card>
      </Link>

      <Link href="/karte/team/game">
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px]">試合スタッツ</div>
              <div className="text-[11.5px] text-ink-soft mt-1">選手ごとの試合スタッツをチーム全体で比較する</div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </Card>
      </Link>

      <Link href="/karte/team/sports-test">
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px]">スポーツテスト</div>
              <div className="text-[11.5px] text-ink-soft mt-1">選手ごとのスポーツテスト結果をチーム全体で比較する</div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </Card>
      </Link>
    </PageShell>
  );
}
