"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { LockIcon, ChevronRightIcon } from "@/components/icons";
import { canManageSettings } from "@/lib/permissions";
import { PLAN_DISPLAY_LABELS } from "@/lib/format";
import type { TeamPlan } from "@/lib/database.types";

// プラン不足でロックされた機能をタップしたときの案内。管理者にはプラン画面へのリンクを、
// それ以外のロールには管理者に相談するよう促すだけに留める(プラン変更は管理者専用のため)。
export function useUpgradePrompt() {
  const router = useRouter();
  const toast = useToast();
  const { role } = useSession();
  return (message: string) => {
    if (canManageSettings(role)) {
      toast(message);
      router.push("/settings/plan");
    } else {
      toast(`${message}(管理者にご相談ください)`);
    }
  };
}

export function LockedFeatureCard({
  label,
  description,
  requiredPlan,
}: {
  label: string;
  description?: string;
  requiredPlan: TeamPlan;
}) {
  const promptUpgrade = useUpgradePrompt();
  return (
    <Card
      className="cursor-pointer opacity-60"
      onClick={() => promptUpgrade(`${label}は${PLAN_DISPLAY_LABELS[requiredPlan]}プラン以上で利用できます`)}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold text-[15px] flex items-center gap-1.5">
            <LockIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
            {label}
          </div>
          {description && <div className="text-[11.5px] text-ink-soft mt-1">{description}</div>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10.5px] font-bold text-orange whitespace-nowrap">
            {PLAN_DISPLAY_LABELS[requiredPlan]}プラン以上
          </span>
          <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft" />
        </div>
      </div>
    </Card>
  );
}
