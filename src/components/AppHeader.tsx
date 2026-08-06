import Link from "next/link";
import { BackIcon } from "@/components/icons";

export function AppHeader({
  title,
  variant = "list",
  backHref,
  rightSlot,
  searchPlaceholder,
}: {
  title: string;
  variant?: "list" | "detail";
  backHref?: string;
  rightSlot?: React.ReactNode;
  searchPlaceholder?: string;
}) {
  const bg = variant === "detail" ? "bg-navy" : "bg-orange";
  return (
    <div className={`${bg} text-white px-4.5 pt-4 pb-4.5`}>
      <div className="flex items-center justify-between">
        {backHref ? (
          <Link href={backHref} aria-label="戻る" className="opacity-95">
            <BackIcon className="w-5 h-5" />
          </Link>
        ) : (
          <span className="text-xl leading-none opacity-95">☰</span>
        )}
        {rightSlot}
      </div>
      <h1 className="font-display font-extrabold text-[22px] mt-2.5 mb-3 leading-tight break-words">
        {title}
      </h1>
      {searchPlaceholder && (
        <div className="bg-white/22 rounded-[10px] px-3 py-2.5 text-[12.5px] text-white/85">
          🔍 {searchPlaceholder}
        </div>
      )}
    </div>
  );
}
