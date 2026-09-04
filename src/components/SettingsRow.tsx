import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";

export function SettingsRow({ href, label, value }: { href: string; label: string; value?: string }) {
  return (
    <Link href={href} className="flex items-center justify-between py-2.5 border-b border-line last:border-b-0">
      <div className="font-bold text-[13.5px]">{label}</div>
      <div className="flex items-center gap-1.5">
        {value && <div className="text-[12.5px] text-ink-soft">{value}</div>}
        <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
      </div>
    </Link>
  );
}
