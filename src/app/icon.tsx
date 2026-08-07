import { ImageResponse } from "next/og";
import { BrandIconMark } from "@/lib/brandIcon";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<BrandIconMark size={size.width} />, { ...size });
}
