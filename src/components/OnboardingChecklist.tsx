"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { canManageSettings } from "@/lib/permissions";

type ChecklistItem = { key: string; label: string; href: string; done: boolean };

// 初回セットアップ直後の管理者向けに、最初にやるべきことをホーム画面に案内する(B-5)。
// PlanLimitBannerと同じく、実データ(選手数・招待発行・予定登録・プッシュ通知登録)を
// 都度クエリして判定するだけで、専用のフラグ列は持たない。全項目達成後は自動的に消える。
export function OnboardingChecklist() {
  const { teamId, role } = useSession();
  const [items, setItems] = useState<ChecklistItem[] | null>(null);

  useEffect(() => {
    if (!canManageSettings(role)) return;
    const supabase = createClient();
    (async () => {
      const [{ count: playerCount }, { count: inviteCount }, { count: scheduleCount }, { count: pushCount }] =
        await Promise.all([
          supabase.from("players").select("id", { count: "exact", head: true }).eq("team_id", teamId).neq("status", "OB・OG"),
          supabase.from("invites").select("id", { count: "exact", head: true }).eq("team_id", teamId),
          supabase.from("schedules").select("id", { count: "exact", head: true }).eq("team_id", teamId),
          supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("team_id", teamId),
        ]);
      setItems([
        { key: "players", label: "選手を登録する", href: "/players", done: (playerCount ?? 0) > 0 },
        { key: "invite", label: "保護者・スタッフを招待する", href: "/users", done: (inviteCount ?? 0) > 0 },
        { key: "schedule", label: "予定を作成する", href: "/schedule", done: (scheduleCount ?? 0) > 0 },
        { key: "push", label: "プッシュ通知をオンにする", href: "/settings", done: (pushCount ?? 0) > 0 },
      ]);
    })();
  }, [teamId, role]);

  if (!canManageSettings(role) || !items || items.every((i) => i.done)) return null;

  const doneCount = items.filter((i) => i.done).length;

  return (
    <div className="rounded-lg border border-line bg-white p-3 mb-2.5">
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold text-[12px]">はじめての設定</div>
        <div className="text-[10.5px] text-ink-soft">
          {doneCount}/{items.length} 完了
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-[12px] ${
              item.done ? "text-ink-soft" : "text-ink bg-paper active:opacity-80"
            }`}
          >
            <span
              className={`flex-none w-4 h-4 rounded-full border flex items-center justify-center text-[9px] ${
                item.done ? "border-green bg-green text-white" : "border-line text-transparent"
              }`}
            >
              ✓
            </span>
            <span className={item.done ? "line-through" : "font-bold"}>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
