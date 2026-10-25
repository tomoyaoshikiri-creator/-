"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { canViewKarte, canViewWorkout } from "@/lib/permissions";
import { hasKarteTabAccess, hasShavingDrillAccess, hasShootingDrillAccess } from "@/lib/plan";

// ワークアウトのハブ画面。「いつどんな練習をしたか」の集計(既存)に加え、数値で記録する
// 個別のドリル(コービーシューティング・シェービングドリル)への入口をカードとして並べる。
// ドリル2種はSignature Edition限定のため、対象プラン以外には存在自体を表示しない。
// このハブ自体は全ロールに開放する(canViewWorkout、ユーザー指示)。
export default function KarteTeamWorkoutPage() {
  const router = useRouter();
  const { role, plan } = useSession();
  // 指導者・管理者は「チームカルテ」経由、一般・運営は「チーム」hub経由で来るため、
  // 戻り先をそれぞれの入口に合わせる。
  const backHref = canViewKarte(role) ? "/karte/team" : "/team";

  useEffect(() => {
    if (!canViewWorkout(role) || !hasKarteTabAccess(plan)) router.replace("/home");
  }, [role, plan, router]);

  return (
    <PageShell header={<AppHeader title="ワークアウト" variant="list" backHref={backHref} />}>
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
                <div className="text-[11.5px] text-ink-soft mt-1">タイムを計測・記録する</div>
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
                <div className="text-[11.5px] text-ink-soft mt-1">4種目の回数を記録する</div>
              </div>
              <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
            </div>
          </Card>
        </Link>
      )}
    </PageShell>
  );
}
