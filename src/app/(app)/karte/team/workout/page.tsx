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
import { hasKarteTabAccess, hasShavingDrillAccess, hasShootingDrillAccess } from "@/lib/plan";

// ワークアウトのハブ画面。「いつどんな練習をしたか」の集計(既存)に加え、数値で記録する
// 個別のドリル(コービーシューティング・シェービングドリル)への入口をカードとして並べる。
// ドリル2種はSignature Edition限定のため、対象プラン以外には存在自体を表示しない。
export default function KarteTeamWorkoutPage() {
  const router = useRouter();
  const { role, plan } = useSession();
  const isStaff = canViewKarte(role);

  useEffect(() => {
    if (!canViewKarte(role) || !hasKarteTabAccess(plan)) router.replace("/home");
  }, [role, plan, router]);

  return (
    <PageShell header={<AppHeader title="ワークアウト" variant="list" backHref="/karte/team" accessBadge="coach" />}>
      <Link href="/karte/team/workout/menu">
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px]">ワークアウトメニュー集計</div>
              <div className="text-[11.5px] text-ink-soft mt-1">いつどんな練習をしたかの履歴</div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </Card>
      </Link>

      {hasShootingDrillAccess(plan) && (
        <Link href="/karte/team/shooting">
          <Card className="cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-[15px]">コービーシューティング</div>
                <div className="text-[11.5px] text-ink-soft mt-1">
                  {isStaff ? "タイムを計測・記録する" : "紐づく選手の記録を見る"}
                </div>
              </div>
              <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
            </div>
          </Card>
        </Link>
      )}

      {hasShavingDrillAccess(plan) && (
        <Link href="/karte/team/workout/shaving">
          <Card className="cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-[15px]">シェービングドリル</div>
                <div className="text-[11.5px] text-ink-soft mt-1">
                  {isStaff ? "4種目の回数を記録する" : "紐づく選手の記録を見る"}
                </div>
              </div>
              <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
            </div>
          </Card>
        </Link>
      )}
    </PageShell>
  );
}
