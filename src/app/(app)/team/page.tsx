"use client";

import Link from "next/link";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, SectionLabel } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { LockedFeatureCard } from "@/components/PlanLock";
import { canViewKarte, canWriteCoachNote } from "@/lib/permissions";
import { hasCoachNoteAccess, hasSkillTestAccess, hasSportsTestAccess } from "@/lib/plan";
import { useTabBadges } from "@/lib/tabBadges";

// ナビ再設計v3の「チーム」hub。既存画面(選手一覧・カルテ・チーム日報・コーチ日報・
// ライブラリ)への薄い索引のみで、リンク先ページの中身は一切変更しない。
// セクション順・行の並びは全ロール共通で固定し、ロール非該当の行はアップセルに
// 使わず出さない(プラン不足の行だけ、ロールが適格な場合に限り小さな案内に留める)。
function HubRow({
  href,
  label,
  description,
  unseen,
}: {
  href: string;
  label: string;
  description: string;
  unseen?: boolean;
}) {
  return (
    <Link href={href}>
      <Card className="cursor-pointer">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-[15px] flex items-center gap-1.5">
              {unseen && <span className="w-[7px] h-[7px] rounded-full bg-danger flex-shrink-0" />}
              {label}
            </div>
            <div className="text-[11.5px] text-ink-soft mt-1">{description}</div>
          </div>
          <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
        </div>
      </Card>
    </Link>
  );
}

export default function TeamHubPage() {
  const { role, plan, userId, teamId } = useSession();
  const badges = useTabBadges(userId, teamId);
  const isStaff = canViewKarte(role);
  const canCoachNote = canWriteCoachNote(role);

  return (
    <PageShell header={<AppHeader title="チーム" />}>
      <SectionLabel>日報</SectionLabel>
      <HubRow href="/report" label="チーム日報" description="練習・活動の様子を共有する" unseen={badges.report} />
      {canCoachNote &&
        (hasCoachNoteAccess(plan) ? (
          <HubRow href="/coach-note" label="コーチ日報" description="指導者・管理者だけで共有する日報" unseen={badges.coachNote} />
        ) : (
          <LockedFeatureCard label="コーチ日報" description="指導者・管理者だけで共有する日報" requiredPlan="中間" />
        ))}

      <SectionLabel>選手・成長</SectionLabel>
      <HubRow href="/players" label="選手一覧" description="選手の基本情報・成長記録・メモを見る" />
      {/* スポーツテスト・検定管理は一般・運営にも開放している(見られるのは自分に紐づく
          選手の記録+チーム平均のみ、スタッフは全選手を見る・編集できる)ため、
          isStaffで囲わずロールを問わず表示する。 */}
      {hasSportsTestAccess(plan) ? (
        <HubRow
          href="/karte/team/sports-test"
          label="スポーツテスト"
          description={
            isStaff ? "スポーツテスト・身長体重の記録をチームで比較する" : "紐づく選手の記録とチーム平均を見る"
          }
        />
      ) : (
        <LockedFeatureCard label="スポーツテスト" description="スポーツテスト・身長体重の記録をチームで比較する" requiredPlan="Max" />
      )}
      {hasSkillTestAccess(plan) ? (
        <HubRow
          href="/karte/team/skill-tests"
          label="検定管理"
          description={isStaff ? "選手ごとの検定ランクを一括で管理" : "紐づく選手の検定ランクを見る"}
        />
      ) : (
        <LockedFeatureCard label="検定管理" description="選手ごとの検定ランクを一括で管理" requiredPlan="Max" />
      )}
      {isStaff && (
        <>
          <HubRow href="/karte/players" label="選手カルテ" description="選手ごとにスタッツ・スポーツテストを見る・分析する" unseen={badges.karte} />
          <HubRow href="/karte/team" label="チームカルテ" description="項目別ランキングでチーム全体を見る・分析する" unseen={badges.karte} />
        </>
      )}

      <SectionLabel>資料</SectionLabel>
      <HubRow href="/library" label="ライブラリ" description="画像・資料の共有置き場" unseen={badges.library} />
    </PageShell>
  );
}
