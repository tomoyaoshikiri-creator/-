"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { canManageSettings } from "@/lib/permissions";
import { isOverPlayerLimit, isOverStorageLimit, playerLimitForPlan } from "@/lib/plan";

// 有料→無料化(ダウングレード)等で選手数・ストレージ使用量が新プランの上限を超えている
// チームの管理者に、ホーム画面で常設の案内を出す(A-5)。既存データは削除・非表示にせず、
// 新規の選手登録・アップロードがブロックされている旨と、その理由を伝えるのみ。
// 解消されれば(プランを上げる/選手を減らす/ファイルを整理する)自動的に消える。
export function PlanLimitBanner() {
  const { teamId, role, plan } = useSession();
  const [overPlayer, setOverPlayer] = useState(false);
  const [overStorage, setOverStorage] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);

  useEffect(() => {
    if (!canManageSettings(role)) return;
    const supabase = createClient();
    (async () => {
      const [{ count }, { data: team }, { data: usage }] = await Promise.all([
        supabase.from("players").select("id", { count: "exact", head: true }).eq("team_id", teamId).neq("status", "OB・OG"),
        supabase.from("teams").select("storage_limit_bytes").eq("id", teamId).single(),
        supabase.rpc("team_storage_usage_bytes"),
      ]);
      setPlayerCount(count ?? 0);
      setOverPlayer(isOverPlayerLimit(count ?? 0, plan));
      setOverStorage(isOverStorageLimit(usage ?? 0, team?.storage_limit_bytes ?? 0));
    })();
  }, [teamId, role, plan]);

  if (!canManageSettings(role) || (!overPlayer && !overStorage)) return null;

  const playerLimit = playerLimitForPlan(plan);

  return (
    <Link
      href="/settings/plan"
      className="block rounded-lg border-2 border-danger bg-danger/8 px-3 py-2 mb-2.5 active:opacity-85"
    >
      <div className="font-mono font-bold text-[12px] tracking-[0.05em] text-danger mb-0.5">プランの上限を超えています</div>
      <div className="text-[12.5px] text-ink leading-relaxed">
        {overPlayer && (
          <div>
            選手登録数が上限を超えています({playerCount}/{playerLimit}人)。新しい選手は追加できません。
          </div>
        )}
        {overStorage && <div>ストレージ使用量が上限を超えています。新しいファイルをアップロードできません。</div>}
      </div>
      <div className="text-[11px] text-danger font-bold mt-1">プランを確認する ›</div>
    </Link>
  );
}
