import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { ChevronRightIcon } from "@/components/icons";

export function SettingsRow({
  href,
  label,
  value,
  icon: Icon,
}: {
  href: string;
  label: string;
  value?: string;
  // 視認性のため意味のある行だけに指定する任意アイコン(2026-10-29 設定画面刷新)。
  // 省略時は従来通りアイコンなしで表示され、既存の呼び出し元(settings/team等)は
  // 無変更で今まで通り動作する(後方互換)。
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}) {
  return (
    <Link href={href} className="flex items-center justify-between py-2.5 border-b border-line last:border-b-0">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className="w-4 h-4 text-ink-soft flex-shrink-0" aria-hidden="true" />}
        <div className="font-bold text-[13.5px] truncate">{label}</div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {value && <div className="text-[12.5px] text-ink-soft">{value}</div>}
        <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
      </div>
    </Link>
  );
}
