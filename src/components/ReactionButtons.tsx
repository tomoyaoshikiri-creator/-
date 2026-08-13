import { REACTIONS } from "@/lib/reactions";
import type { ReactionType } from "@/lib/database.types";

interface ReactionRow {
  profile_id: string;
  reaction_type: ReactionType;
}

export function ReactionButtons({
  reactions,
  onToggle,
}: {
  reactions: ReactionRow[];
  onToggle: (type: ReactionType) => void;
}) {
  return (
    <div className="flex gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
      {REACTIONS.map(({ type, src, alt }) => {
        const forTarget = reactions.filter((r) => r.reaction_type === type);
        const active = forTarget.length > 0;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onToggle(type)}
            className={`flex items-center gap-1 px-2 py-1 rounded-full border ${
              active ? "border-orange bg-orange/8" : "border-line bg-paper"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} className="w-4 h-4" />
            {active && <span className="text-[10.5px] font-bold text-orange">{forTarget.length}</span>}
          </button>
        );
      })}
    </div>
  );
}
