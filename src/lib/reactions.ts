import type { ReactionType } from "./database.types";

export const REACTIONS: { type: ReactionType; src: string; alt: string }[] = [
  { type: "thumbs_up", src: "/emoji/thumbs-up.svg", alt: "👍" },
  { type: "ok_gesture", src: "/emoji/ok-gesture.svg", alt: "🙆‍♂️" },
  { type: "bow", src: "/emoji/bow.svg", alt: "🙇" },
  { type: "pray", src: "/emoji/pray.svg", alt: "🙏" },
];
