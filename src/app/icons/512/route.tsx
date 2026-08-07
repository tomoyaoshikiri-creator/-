import { ImageResponse } from "next/og";
import { BrandIconMark } from "@/lib/brandIcon";

export async function GET() {
  return new ImageResponse(<BrandIconMark size={512} />, { width: 512, height: 512 });
}
